// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title VaccineRegistry v3
 * @notice NFT SBT + Merkle Tree + NIK Binding + Revoke Workflow + History + Undo
 *
 * FITUR BARU v3:
 * - Revoke harus melalui request dari faskes → approval dari owner
 * - Owner bisa langsung revoke (emergency)
 * - Owner bisa undo revoke (kembalikan ke Valid)
 * - History setiap token tersimpan permanen di blockchain
 * - Token ID lebih deskriptif (chainId + timestamp encoded)
 */
contract VaccineRegistry is ERC721 {
    using Strings for uint256;

    // ─────────────────────────────────────────────
    //  ENUMS & STRUCTS
    // ─────────────────────────────────────────────

    enum RecordStatus        { NotExists, Valid, Revoked }
    enum RevokeRequestStatus { Pending, Approved, Rejected }

    struct VaccineRecord {
        RecordStatus status;
        address      issuer;
        uint256      timestamp;
        string       facilityName;
        string       vaccineType;
        bytes32      dataHash;
    }

    struct RevokeRequest {
        uint256             tokenId;
        address             requestedBy;
        string              facilityName;
        string              reason;
        uint256             timestamp;
        RevokeRequestStatus status;
    }

    struct HistoryEntry {
        string  action;     // "Minted" | "RevokeRequested" | "Revoked" | "RevokeRejected" | "Restored"
        address actor;
        string  note;
        uint256 timestamp;
    }

    // ─────────────────────────────────────────────
    //  STATE VARIABLES
    // ─────────────────────────────────────────────

    address public owner;

    mapping(uint256  => VaccineRecord)    public records;
    mapping(bytes32  => bool)             public usedHashes;
    mapping(address  => bool)             public authorizedIssuers;
    mapping(address  => string)           public issuerNames;
    mapping(bytes32  => bool)             public rootActive;

    // NIK Binding
    mapping(address  => bytes32)          public walletNikHash;
    mapping(bytes32  => address)          public nikHashWallet;
    mapping(bytes32  => uint256[])        private nikTokens;

    // Revoke requests
    mapping(uint256  => RevokeRequest)    public revokeRequests;  // requestId → request
    mapping(uint256  => uint256[])        public tokenRequests;   // tokenId → requestIds
    uint256                               public nextRequestId;
    uint256[]                             public pendingRequestIds;

    // History per token
    mapping(uint256  => HistoryEntry[])   public tokenHistory;

    uint256 public nextTokenId;
    uint256 public totalRecords;
    uint256[] public allTokenIds;  // Track semua tokenId yang pernah di-mint

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event RecordAdded(uint256 indexed tokenId, bytes32 indexed dataHash, address indexed issuer, address patient);
    event BatchRootAdded(bytes32 indexed root, address indexed issuer);
    event RevokeRequested(uint256 indexed requestId, uint256 indexed tokenId, address indexed requestedBy, string reason);
    event RevokeApproved(uint256 indexed requestId, uint256 indexed tokenId, address approvedBy);
    event RevokeRejected(uint256 indexed requestId, uint256 indexed tokenId, address rejectedBy, string note);
    event RevokeUndone(uint256 indexed tokenId, address restoredBy, string reason);
    event IssuerAuthorized(address indexed issuer, string facilityName);
    event IssuerRemoved(address indexed issuer);
    event NikBound(address indexed wallet, bytes32 indexed nikHash);
    event NikBindingReset(address indexed wallet, bytes32 indexed nikHash, address indexed resetBy);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Hanya owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedIssuers[msg.sender], "Bukan faskes teregistrasi");
        _;
    }

    modifier onlyOwnerOrIssuer() {
        require(msg.sender == owner || authorizedIssuers[msg.sender], "Hanya owner atau faskes");
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() ERC721("VaxChain Certificate", "VAX") {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        issuerNames[msg.sender]       = "Kementerian Kesehatan RI";
        emit IssuerAuthorized(msg.sender, "Kementerian Kesehatan RI");
    }

    // Soulbound
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert("Soulbound: tidak bisa dipindah");
        return super._update(to, tokenId, auth);
    }

    // ─────────────────────────────────────────────
    //  ADMIN
    // ─────────────────────────────────────────────

    function authorizeIssuer(address issuer, string calldata name) external onlyOwner {
        require(issuer != address(0) && bytes(name).length > 0, "Input tidak valid");
        authorizedIssuers[issuer] = true;
        issuerNames[issuer]       = name;
        emit IssuerAuthorized(issuer, name);
    }

    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Alamat tidak valid");
        owner = newOwner;
    }

    // ─────────────────────────────────────────────
    //  MINT LANGSUNG (per pasien)
    // ─────────────────────────────────────────────

    function addVaccineRecord(
        address patient,
        bytes32 dataHash,
        string calldata vaccineType,
        bytes32 nikHash
    ) external onlyAuthorized {
        require(!usedHashes[dataHash], "Hash sudah digunakan");
        require(patient != address(0) && nikHash != bytes32(0), "Input tidak valid");

        uint256 tokenId = _generateComplexId(dataHash, patient);
        records[tokenId] = VaccineRecord({
            status:       RecordStatus.Valid,
            issuer:       msg.sender,
            timestamp:    block.timestamp,
            facilityName: issuerNames[msg.sender],
            vaccineType:  vaccineType,
            dataHash:     dataHash
        });

        usedHashes[dataHash] = true;
        nikTokens[nikHash].push(tokenId);
        allTokenIds.push(tokenId);
        totalRecords++;

        // Auto-bind NIK ke wallet pasien jika belum terikat
        // Faskes sudah verifikasi KTP saat catat vaksin → aman
        if (walletNikHash[patient] == bytes32(0) && nikHashWallet[nikHash] == address(0)) {
            walletNikHash[patient] = nikHash;
            nikHashWallet[nikHash] = patient;
            emit NikBound(patient, nikHash);
        }

        // Catat history
        tokenHistory[tokenId].push(HistoryEntry({
            action:    "Minted",
            actor:     msg.sender,
            note:      string(abi.encodePacked("Vaksin: ", vaccineType, " | Faskes: ", issuerNames[msg.sender])),
            timestamp: block.timestamp
        }));

        _safeMint(patient, tokenId);
        emit RecordAdded(tokenId, dataHash, msg.sender, patient);
    }

    // ─────────────────────────────────────────────
    //  MERKLE BATCH
    // ─────────────────────────────────────────────

    function addBatchRoot(bytes32 root) external onlyAuthorized {
        rootActive[root] = true;
        emit BatchRootAdded(root, msg.sender);
    }

    function claimCertificate(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 dataHash,
        string calldata vaccineType,
        bytes32 nikHash
    ) external {
        require(rootActive[root], "Root tidak aktif");
        require(!usedHashes[dataHash], "Sudah diklaim");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, dataHash, vaccineType));
        require(MerkleProof.verify(proof, root, leaf), "Proof tidak valid");

        uint256 tokenId = _generateComplexId(dataHash, msg.sender);
        records[tokenId] = VaccineRecord({
            status:       RecordStatus.Valid,
            issuer:       address(0),
            timestamp:    block.timestamp,
            facilityName: "Verified Batch Upload",
            vaccineType:  vaccineType,
            dataHash:     dataHash
        });

        usedHashes[dataHash] = true;
        if (nikHash != bytes32(0)) nikTokens[nikHash].push(tokenId);
        allTokenIds.push(tokenId);
        totalRecords++;

        tokenHistory[tokenId].push(HistoryEntry({
            action:    "Minted (Batch)",
            actor:     msg.sender,
            note:      string(abi.encodePacked("Claimed via Merkle Proof | Vaksin: ", vaccineType)),
            timestamp: block.timestamp
        }));

        _safeMint(msg.sender, tokenId);
        emit RecordAdded(tokenId, dataHash, address(0), msg.sender);
    }

    // ─────────────────────────────────────────────
    //  REVOKE WORKFLOW
    // ─────────────────────────────────────────────

    /**
     * @notice Faskes ajukan permintaan revoke ke owner
     * @param tokenId Token yang ingin direvoke
     * @param reason  Alasan revoke
     */
    function requestRevoke(uint256 tokenId, string calldata reason) external onlyAuthorized {
        _requireOwned(tokenId);
        require(records[tokenId].status == RecordStatus.Valid, "Sertifikat tidak valid");
        require(bytes(reason).length > 0, "Alasan wajib diisi");

        uint256 reqId = nextRequestId++;
        revokeRequests[reqId] = RevokeRequest({
            tokenId:      tokenId,
            requestedBy:  msg.sender,
            facilityName: issuerNames[msg.sender],
            reason:       reason,
            timestamp:    block.timestamp,
            status:       RevokeRequestStatus.Pending
        });

        tokenRequests[tokenId].push(reqId);
        pendingRequestIds.push(reqId);

        tokenHistory[tokenId].push(HistoryEntry({
            action:    "RevokeRequested",
            actor:     msg.sender,
            note:      string(abi.encodePacked("Diminta oleh: ", issuerNames[msg.sender], " | Alasan: ", reason)),
            timestamp: block.timestamp
        }));

        emit RevokeRequested(reqId, tokenId, msg.sender, reason);
    }

    /**
     * @notice Owner setujui revoke request
     */
    function approveRevoke(uint256 requestId) external onlyOwner {
        RevokeRequest storage req = revokeRequests[requestId];
        require(req.status == RevokeRequestStatus.Pending, "Request bukan pending");
        require(records[req.tokenId].status == RecordStatus.Valid, "Token sudah direvoke");

        req.status                    = RevokeRequestStatus.Approved;
        records[req.tokenId].status   = RecordStatus.Revoked;

        _removePending(requestId);

        tokenHistory[req.tokenId].push(HistoryEntry({
            action:    "Revoked",
            actor:     msg.sender,
            note:      string(abi.encodePacked("Disetujui owner | Request dari: ", req.facilityName)),
            timestamp: block.timestamp
        }));

        emit RevokeApproved(requestId, req.tokenId, msg.sender);
    }

    /**
     * @notice Owner tolak revoke request
     */
    function rejectRevoke(uint256 requestId, string calldata note) external onlyOwner {
        RevokeRequest storage req = revokeRequests[requestId];
        require(req.status == RevokeRequestStatus.Pending, "Request bukan pending");

        req.status = RevokeRequestStatus.Rejected;
        _removePending(requestId);

        tokenHistory[req.tokenId].push(HistoryEntry({
            action:    "RevokeRejected",
            actor:     msg.sender,
            note:      string(abi.encodePacked("Ditolak owner | ", note)),
            timestamp: block.timestamp
        }));

        emit RevokeRejected(requestId, req.tokenId, msg.sender, note);
    }

    /**
     * @notice Owner revoke langsung (emergency, tanpa request)
     */
    function emergencyRevoke(uint256 tokenId, string calldata reason) external onlyOwner {
        _requireOwned(tokenId);
        require(records[tokenId].status == RecordStatus.Valid, "Sudah direvoke");

        records[tokenId].status = RecordStatus.Revoked;

        tokenHistory[tokenId].push(HistoryEntry({
            action:    "Revoked (Emergency)",
            actor:     msg.sender,
            note:      string(abi.encodePacked("Emergency revoke oleh owner | Alasan: ", reason)),
            timestamp: block.timestamp
        }));
    }

    /**
     * @notice Owner undo revoke — kembalikan sertifikat ke Valid
     */
    function undoRevoke(uint256 tokenId, string calldata reason) external onlyOwner {
        _requireOwned(tokenId);
        require(records[tokenId].status == RecordStatus.Revoked, "Token tidak direvoke");

        records[tokenId].status = RecordStatus.Valid;

        tokenHistory[tokenId].push(HistoryEntry({
            action:    "Restored",
            actor:     msg.sender,
            note:      string(abi.encodePacked("Dikembalikan oleh owner | Alasan: ", reason)),
            timestamp: block.timestamp
        }));

        emit RevokeUndone(tokenId, msg.sender, reason);
    }

    // ─────────────────────────────────────────────
    //  NIK BINDING
    // ─────────────────────────────────────────────

    /**
     * @notice Faskes/Owner ikat NIK ke wallet pasien secara langsung
     * Dipanggil saat pasien hadir dan KTP sudah diverifikasi petugas
     * Pasien tidak bisa bind NIK sendiri — mencegah klaim NIK orang lain
     */
    function bindNikForPatient(address patient, bytes32 nikHash) external onlyAuthorized {
        require(patient != address(0), "Alamat pasien tidak valid");
        require(nikHash != bytes32(0), "NIK hash tidak valid");
        require(walletNikHash[patient] == bytes32(0), "Wallet pasien sudah terikat ke NIK lain");
        require(nikHashWallet[nikHash] == address(0), "NIK sudah terikat ke wallet lain");
        walletNikHash[patient] = nikHash;
        nikHashWallet[nikHash] = patient;
        emit NikBound(patient, nikHash);
    }

    function resetNikBinding(address wallet) external onlyOwnerOrIssuer {
        bytes32 nikHash = walletNikHash[wallet];
        require(nikHash != bytes32(0), "Wallet belum terikat ke NIK");
        nikHashWallet[nikHash] = address(0);
        walletNikHash[wallet]  = bytes32(0);
        emit NikBindingReset(wallet, nikHash, msg.sender);
    }

    // ─────────────────────────────────────────────
    //  VIEW FUNCTIONS
    // ─────────────────────────────────────────────

    function getTokensByNik(bytes32 nikHash) external view returns (uint256[] memory) {
        return nikTokens[nikHash];
    }

    function getNikHashByWallet(address wallet) external view returns (bytes32) {
        return walletNikHash[wallet];
    }

    function isAuthorizedIssuer(address addr) external view returns (bool) {
        return authorizedIssuers[addr];
    }

    function getTokenHistory(uint256 tokenId) external view returns (HistoryEntry[] memory) {
        return tokenHistory[tokenId];
    }

    function getTokenRequests(uint256 tokenId) external view returns (uint256[] memory) {
        return tokenRequests[tokenId];
    }

    function getPendingRequests() external view returns (uint256[] memory) {
        return pendingRequestIds;
    }

    // ─────────────────────────────────────────────
    //  METADATA — On-chain SVG
    // ─────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        VaccineRecord memory rec = records[tokenId];

        string memory certId = _formatCertId(tokenId, rec.timestamp);
        string memory image  = _generateSVG(tokenId, rec, certId);
        string memory json   = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"VaxChain ', certId,
            '","description":"Sertifikat Vaksin Digital Terverifikasi - Soulbound Token","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(image)),
            '","attributes":[',
            '{"trait_type":"Certificate ID","value":"', certId, '"},',
            '{"trait_type":"Vaccine","value":"',         rec.vaccineType, '"},',
            '{"trait_type":"Issuer","value":"',          rec.facilityName, '"},',
            '{"trait_type":"Status","value":"',          rec.status == RecordStatus.Valid ? "Valid" : "Revoked", '"},',
            '{"trait_type":"Token ID","value":"',        tokenId.toString(), '"}',
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /**
     * Format: VAX-YYYY-XXXXXX
     * Lebih deskriptif dan unik dari sekedar integer
     */
    function _formatCertId(uint256 tokenId, uint256 timestamp) internal pure returns (string memory) {
        uint256 year = 1970 + timestamp / 31557600;
        return string(abi.encodePacked(
            "VAX-", year.toString(), "-", _padZero(tokenId, 6)
        ));
    }

    function _padZero(uint256 num, uint256 digits) internal pure returns (string memory) {
        string memory s = num.toString();
        bytes memory b  = bytes(s);
        if (b.length >= digits) return s;
        bytes memory padded = new bytes(digits);
        uint256 padding = digits - b.length;
        for (uint256 i = 0; i < padding; i++) padded[i] = "0";
        for (uint256 i = 0; i < b.length; i++) padded[padding + i] = b[i];
        return string(padded);
    }

    function _generateSVG(uint256 tokenId, VaccineRecord memory rec, string memory certId) internal pure returns (string memory) {
        string memory sc = rec.status == RecordStatus.Valid ? "#10b981" : "#ef4444";
        string memory st = rec.status == RecordStatus.Valid ? "VALID" : "REVOKED";
        return string(abi.encodePacked(
            '<svg width="420" height="600" viewBox="0 0 420 600" xmlns="http://www.w3.org/2000/svg">',
            '<defs>',
            '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">',
            '<stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1a2744"/>',
            '</linearGradient>',
            '<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">',
            '<stop offset="0%" stop-color="', sc, '"/><stop offset="100%" stop-color="', sc, '" stop-opacity="0.5"/>',
            '</linearGradient>',
            '</defs>',
            '<rect width="100%" height="100%" fill="url(#bg)"/>',
            '<rect x="0" y="0" width="6" height="600" fill="url(#accent)"/>',
            '<rect x="18" y="18" width="384" height="564" rx="12" fill="none" stroke="', sc, '" stroke-width="1" opacity="0.3"/>',
            // Header
            '<rect x="30" y="30" width="360" height="60" rx="8" fill="', sc, '" opacity="0.1"/>',
            '<text x="210" y="58" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="', sc, '" letter-spacing="3">SERTIFIKAT VAKSIN DIGITAL</text>',
            '<text x="210" y="76" font-family="Arial" font-size="10" text-anchor="middle" fill="#64748b">VaxChain Blockchain Certificate</text>',
            // Cert ID
            '<text x="50" y="118" font-family="monospace" font-size="11" fill="#64748b">CERTIFICATE ID</text>',
            '<text x="50" y="140" font-family="monospace" font-size="18" font-weight="bold" fill="', sc, '">', certId, '</text>',
            '<rect x="30" y="155" width="360" height="1" fill="#1e293b"/>',
            // Fields
            '<text x="50" y="182" font-family="Arial" font-size="10" fill="#64748b">JENIS VAKSIN</text>',
            '<text x="50" y="202" font-family="Arial" font-size="15" font-weight="bold" fill="#f1f5f9">', rec.vaccineType, '</text>',
            '<text x="50" y="236" font-family="Arial" font-size="10" fill="#64748b">FASILITAS KESEHATAN</text>',
            '<text x="50" y="256" font-family="Arial" font-size="13" fill="#f1f5f9">', rec.facilityName, '</text>',
            '<text x="50" y="290" font-family="Arial" font-size="10" fill="#64748b">TOKEN ID (BLOCKCHAIN)</text>',
            '<text x="50" y="310" font-family="monospace" font-size="13" fill="#60a5fa">#', tokenId.toString(), '</text>',
            '<rect x="30" y="325" width="360" height="1" fill="#1e293b"/>',
            // Status badge
            '<rect x="50" y="340" width="100" height="28" rx="14" fill="', sc, '" opacity="0.15"/>',
            '<text x="100" y="359" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="', sc, '">', st, '</text>',
            // QR placeholder area
            '<rect x="130" y="380" width="160" height="160" rx="8" fill="#111827" stroke="#1e293b" stroke-width="1"/>',
            '<text x="210" y="455" font-family="Arial" font-size="10" text-anchor="middle" fill="#475569">QR Code</text>',
            '<text x="210" y="470" font-family="Arial" font-size="9" text-anchor="middle" fill="#334155">Scan via VaxChain App</text>',
            // Footer
            '<text x="210" y="570" font-family="Arial" font-size="9" text-anchor="middle" fill="#334155">vaxchain.app - Powered by Blockchain Technology</text>',
            '</svg>'
        ));
    }

    // ─────────────────────────────────────────────
    //  VIEW HELPERS
    // ─────────────────────────────────────────────

    /** Ambil semua tokenId yang pernah di-mint */
    function getAllTokenIds() external view returns (uint256[] memory) {
        return allTokenIds;
    }

    // ─────────────────────────────────────────────
    //  INTERNAL HELPERS
    // ─────────────────────────────────────────────

    /**
     * Generate tokenId kompleks dari hash — jauh lebih deskriptif dari 0,1,2
     * Format: 12-digit number yang unik per transaksi
     */
    function _generateComplexId(bytes32 dataHash, address patient) internal returns (uint256) {
        uint256 raw = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            patient,
            dataHash,
            nextTokenId
        )));
        nextTokenId++;
        // Ambil 12 digit terakhir, pastikan tidak collision
        uint256 tokenId = (raw % 900000000000) + 100000000000; // 12-digit: 100000000000 - 999999999999
        // Kalau collision (sangat jarang), tambah offset
        while (_ownerOf(tokenId) != address(0)) {
            tokenId = tokenId + 1;
        }
        return tokenId;
    }

    function _removePending(uint256 requestId) internal {
        uint256 len = pendingRequestIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (pendingRequestIds[i] == requestId) {
                pendingRequestIds[i] = pendingRequestIds[len - 1];
                pendingRequestIds.pop();
                break;
            }
        }
    }
}

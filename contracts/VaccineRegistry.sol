// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title VaccineRegistry
 * @notice DApps Rekam Vaksin Digital — NFT (SBT) + Merkle Tree + NIK Binding
 *
 * FITUR LENGKAP:
 * 1. ERC721 Soulbound Token — sertifikat vaksin sebagai NFT tidak bisa dipindah
 * 2. Merkle Tree — batch upload gas-efficient
 * 3. NIK Binding — pasien cari sertifikat by NIK tanpa perlu tahu wallet address
 * 4. On-chain SVG metadata
 * 5. Social Login compatible (Web3Auth)
 */
contract VaccineRegistry is ERC721 {
    using Strings for uint256;

    enum RecordStatus { NotExists, Valid, Revoked }

    struct VaccineRecord {
        RecordStatus status;
        address      issuer;
        uint256      timestamp;
        string       facilityName;
        string       vaccineType;
        bytes32      dataHash;
    }

    address public owner;

    mapping(uint256 => VaccineRecord) public records;
    mapping(bytes32 => bool)          public usedHashes;
    mapping(address => bool)          public authorizedIssuers;
    mapping(address => string)        public issuerNames;
    mapping(bytes32 => bool)          public rootActive;

    // NIK Binding
    mapping(address => bytes32)       public walletNikHash;
    mapping(bytes32 => address)       public nikHashWallet;
    mapping(bytes32 => uint256[])     private nikTokens;

    uint256 public nextTokenId;
    uint256 public totalRecords;

    event RecordAdded(uint256 indexed tokenId, bytes32 indexed dataHash, address indexed issuer, address patient);
    event BatchRootAdded(bytes32 indexed root, address indexed issuer);
    event IssuerAuthorized(address indexed issuer, string facilityName);
    event IssuerRemoved(address indexed issuer);
    event NikBound(address indexed wallet, bytes32 indexed nikHash);
    event NikBindingReset(address indexed wallet, bytes32 indexed nikHash, address indexed resetBy);

    modifier onlyOwner() {
        require(msg.sender == owner, "Hanya owner yang bisa melakukan ini");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedIssuers[msg.sender], "Wallet ini belum terdaftar sebagai fasilitas kesehatan");
        _;
    }

    modifier onlyOwnerOrIssuer() {
        require(msg.sender == owner || authorizedIssuers[msg.sender], "Hanya owner atau faskes");
        _;
    }

    constructor() ERC721("VaxChain Certificate", "VAX") {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        issuerNames[msg.sender]       = "Kementerian Kesehatan RI";
        emit IssuerAuthorized(msg.sender, "Kementerian Kesehatan RI");
    }

    // Soulbound: tidak bisa transfer
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("Sertifikat Soulbound - tidak bisa dipindah tangankan");
        }
        return super._update(to, tokenId, auth);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function authorizeIssuer(address issuer, string calldata name) external onlyOwner {
        require(issuer != address(0), "Alamat tidak valid");
        require(bytes(name).length > 0, "Nama tidak boleh kosong");
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

    // ── Issuer ─────────────────────────────────────────────────────────────────

    /**
     * Catat vaksin + mint NFT ke wallet pasien
     * @param patient      Wallet address pasien (dari Web3Auth social login)
     * @param dataHash     keccak256(NIK|vaksin|batch|tanggal|salt)
     * @param vaccineType  Jenis vaksin
     * @param nikHash      keccak256(NIK) untuk NIK-based lookup
     */
    function addVaccineRecord(
        address patient,
        bytes32 dataHash,
        string calldata vaccineType,
        bytes32 nikHash
    ) external onlyAuthorized {
        require(!usedHashes[dataHash], "Hash sudah digunakan");
        require(patient != address(0), "Alamat pasien tidak valid");
        require(nikHash != bytes32(0), "NIK hash tidak boleh kosong");

        uint256 tokenId = nextTokenId++;
        records[tokenId] = VaccineRecord({
            status:       RecordStatus.Valid,
            issuer:       msg.sender,
            timestamp:    block.timestamp,
            facilityName: issuerNames[msg.sender],
            vaccineType:  vaccineType,
            dataHash:     dataHash
        });

        usedHashes[dataHash]       = true;
        nikTokens[nikHash].push(tokenId);
        totalRecords++;

        _safeMint(patient, tokenId);
        emit RecordAdded(tokenId, dataHash, msg.sender, patient);
    }

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
        require(rootActive[root], "Merkle root tidak aktif");
        require(!usedHashes[dataHash], "Sudah diklaim");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, dataHash, vaccineType));
        require(MerkleProof.verify(proof, root, leaf), "Merkle proof tidak valid");

        uint256 tokenId = nextTokenId++;
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
        totalRecords++;

        _safeMint(msg.sender, tokenId);
        emit RecordAdded(tokenId, dataHash, address(0), msg.sender);
    }

    function revokeCertificate(uint256 tokenId) external {
        _requireOwned(tokenId);
        VaccineRecord storage rec = records[tokenId];
        require(
            msg.sender == owner || msg.sender == rec.issuer || authorizedIssuers[msg.sender],
            "Tidak punya izin revoke"
        );
        require(rec.status == RecordStatus.Valid, "Sudah direvoke");
        rec.status = RecordStatus.Revoked;
    }

    // ── NIK Binding ────────────────────────────────────────────────────────────

    function bindNik(bytes32 nikHash) external {
        require(nikHash != bytes32(0), "NIK hash tidak valid");
        require(walletNikHash[msg.sender] == bytes32(0), "Wallet sudah terikat ke NIK");
        require(nikHashWallet[nikHash] == address(0), "NIK sudah terikat ke wallet lain. Hubungi faskes.");
        walletNikHash[msg.sender] = nikHash;
        nikHashWallet[nikHash]    = msg.sender;
        emit NikBound(msg.sender, nikHash);
    }

    function resetNikBinding(address wallet) external onlyOwnerOrIssuer {
        bytes32 nikHash = walletNikHash[wallet];
        require(nikHash != bytes32(0), "Wallet belum terikat ke NIK");
        nikHashWallet[nikHash] = address(0);
        walletNikHash[wallet]  = bytes32(0);
        emit NikBindingReset(wallet, nikHash, msg.sender);
    }

    // ── View ───────────────────────────────────────────────────────────────────

    function getTokensByNik(bytes32 nikHash) external view returns (uint256[] memory) {
        return nikTokens[nikHash];
    }

    function getNikHashByWallet(address wallet) external view returns (bytes32) {
        return walletNikHash[wallet];
    }

    function isAuthorizedIssuer(address addr) external view returns (bool) {
        return authorizedIssuers[addr];
    }

    // ── On-chain SVG Metadata ──────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        VaccineRecord memory rec = records[tokenId];

        string memory image = _generateSVG(tokenId, rec);
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"VaxChain #', tokenId.toString(),
            '","description":"Sertifikat Vaksin Digital Terverifikasi","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(image)),
            '","attributes":[{"trait_type":"Vaccine","value":"', rec.vaccineType,
            '"},{"trait_type":"Issuer","value":"', rec.facilityName,
            '"},{"trait_type":"Status","value":"', rec.status == RecordStatus.Valid ? "Valid" : "Revoked",
            '"}]}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _generateSVG(uint256 tokenId, VaccineRecord memory rec) internal pure returns (string memory) {
        string memory sc = rec.status == RecordStatus.Valid ? "#10b981" : "#ef4444";
        string memory st = rec.status == RecordStatus.Valid ? "VALID" : "REVOKED";
        return string(abi.encodePacked(
            '<svg width="400" height="560" viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">',
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">',
            '<stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/>',
            '</linearGradient></defs>',
            '<rect width="100%" height="100%" fill="url(#bg)"/>',
            '<rect x="16" y="16" width="368" height="528" rx="16" fill="none" stroke="', sc, '" stroke-width="2" opacity="0.5"/>',
            '<text x="200" y="88" font-family="Arial" font-size="32" text-anchor="middle">&#128137;</text>',
            '<text x="200" y="136" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle" fill="#f1f5f9">SERTIFIKAT VAKSIN</text>',
            '<text x="200" y="156" font-family="Arial" font-size="11" text-anchor="middle" fill="#64748b">VaxChain Digital Certificate</text>',
            '<rect x="40" y="172" width="320" height="1" fill="#1e293b"/>',
            '<text x="40" y="200" font-family="Arial" font-size="11" fill="#64748b">JENIS VAKSIN</text>',
            '<text x="40" y="222" font-family="Arial" font-size="16" font-weight="bold" fill="#f1f5f9">', rec.vaccineType, '</text>',
            '<text x="40" y="258" font-family="Arial" font-size="11" fill="#64748b">FASILITAS KESEHATAN</text>',
            '<text x="40" y="280" font-family="Arial" font-size="14" fill="#f1f5f9">', rec.facilityName, '</text>',
            '<text x="40" y="316" font-family="Arial" font-size="11" fill="#64748b">TOKEN ID</text>',
            '<text x="40" y="338" font-family="Arial" font-size="16" font-weight="bold" fill="#60a5fa">#', tokenId.toString(), '</text>',
            '<rect x="40" y="360" width="320" height="1" fill="#1e293b"/>',
            '<rect x="140" y="376" width="120" height="28" rx="14" fill="', sc, '" opacity="0.15"/>',
            '<text x="200" y="395" font-family="Arial" font-size="13" font-weight="bold" text-anchor="middle" fill="', sc, '">', st, '</text>',
            '<text x="200" y="460" font-family="Arial" font-size="10" text-anchor="middle" fill="#475569">[ QR Code tersedia di aplikasi ]</text>',
            '<text x="200" y="530" font-family="Arial" font-size="10" text-anchor="middle" fill="#334155">VaxChain - Blockchain Vaccine Registry</text>',
            '</svg>'
        ));
    }
}

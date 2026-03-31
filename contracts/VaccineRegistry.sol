// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title VaccineRegistry
 * @notice DApps Rekam Vaksin Digital Berbasis NFT (SBT) & Merkle Tree
 * @dev Menggunakan ERC721 untuk sertifikat, Merkle Tree untuk batching, dan On-chain SVG
 */
contract VaccineRegistry is ERC721, Ownable {
    using Strings for uint256;

    // ─────────────────────────────────────────────
    //  TIPE DATA
    // ─────────────────────────────────────────────

    enum RecordStatus { NotExists, Valid, Revoked }

    struct VaccineRecord {
        RecordStatus status;
        address      issuer;
        uint256      timestamp;
        string       facilityName;
        string       vaccineType;
        bytes32      dataHash; // Original hash for verification
    }

    // ─────────────────────────────────────────────
    //  STATE VARIABLES
    // ─────────────────────────────────────────────

    mapping(uint256 => VaccineRecord) public records;
    mapping(bytes32 => bool) public usedHashes;
    mapping(address => bool) public authorizedIssuers;
    mapping(address => string) public issuerNames;
    
    // Merkle Tree support
    mapping(bytes32 => bool) public rootActive;
    
    uint256 public nextTokenId;
    uint256 public totalRecords;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event RecordAdded(uint256 indexed tokenId, bytes32 indexed dataHash, address indexed issuer);
    event BatchRootAdded(bytes32 indexed root, address indexed issuer);
    event IssuerAuthorized(address indexed issuer, string facilityName);
    event IssuerRemoved(address indexed issuer);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier onlyAuthorized() {
        require(authorizedIssuers[msg.sender], "Not authorized issuer");
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() ERC721("VaxChain Certificate", "VAX") Ownable(msg.sender) {
        authorizedIssuers[msg.sender] = true;
        issuerNames[msg.sender] = "Kementerian Kesehatan RI";
        emit IssuerAuthorized(msg.sender, "Kementerian Kesehatan RI");
    }

    // ─────────────────────────────────────────────
    //  SOULBOUND LOGIC (Non-transferable)
    // ─────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("Sertifikat ini bersifat Soulbound (tidak bisa dipindah tangankan)");
        }
        return super._update(to, tokenId, auth);
    }

    // ─────────────────────────────────────────────
    //  ADMIN FUNCTIONS
    // ─────────────────────────────────────────────

    function authorizeIssuer(address issuer, string calldata name) external onlyOwner {
        authorizedIssuers[issuer] = true;
        issuerNames[issuer] = name;
        emit IssuerAuthorized(issuer, name);
    }

    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    // ─────────────────────────────────────────────
    //  ISSUER FUNCTIONS
    // ─────────────────────────────────────────────

    /**
     * @notice Menambahkan satu record langsung (minting NFT)
     */
    function addVaccineRecord(address patient, bytes32 dataHash, string calldata vaccineType) external onlyAuthorized {
        require(!usedHashes[dataHash], "Hash already used");
        
        uint256 tokenId = nextTokenId++;
        records[tokenId] = VaccineRecord({
            status: RecordStatus.Valid,
            issuer: msg.sender,
            timestamp: block.timestamp,
            facilityName: issuerNames[msg.sender],
            vaccineType: vaccineType,
            dataHash: dataHash
        });

        usedHashes[dataHash] = true;
        totalRecords++;
        _safeMint(patient, tokenId);
        
        emit RecordAdded(tokenId, dataHash, msg.sender);
    }

    /**
     * @notice Mencatat Merkle Root untuk batch upload (Gas efficient)
     */
    function addBatchRoot(bytes32 root) external onlyAuthorized {
        rootActive[root] = true;
        emit BatchRootAdded(root, msg.sender);
    }

    /**
     * @notice Klaim sertifikat menggunakan Merkle Proof
     */
    function claimCertificate(
        bytes32[] calldata proof, 
        bytes32 root, 
        bytes32 dataHash, 
        string calldata vaccineType
    ) external {
        require(rootActive[root], "Merkle root not active");
        require(!usedHashes[dataHash], "Sertifikat sudah diklaim");
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, dataHash, vaccineType));
        require(MerkleProof.verify(proof, root, leaf), "Invalid merkle proof");

        uint256 tokenId = nextTokenId++;
        records[tokenId] = VaccineRecord({
            status: RecordStatus.Valid,
            issuer: address(0), // Root issuer not tracked per mint to save gas
            timestamp: block.timestamp,
            facilityName: "Verified Batch Issuer",
            vaccineType: vaccineType,
            dataHash: dataHash
        });

        usedHashes[dataHash] = true;
        totalRecords++;
        _safeMint(msg.sender, tokenId);

        emit RecordAdded(tokenId, dataHash, msg.sender);
    }

    /**
     * @notice Membatalkan sertifikat (misal: salah input)
     * @param tokenId  ID sertifikat yang ingin dibatalkan
     */
    function revokeCertificate(uint256 tokenId) external {
        _requireOwned(tokenId);
        VaccineRecord storage rec = records[tokenId];
        
        require(
            msg.sender == owner() || msg.sender == rec.issuer || authorizedIssuers[msg.sender],
            "Hanya penerbit atau admin yang bisa merevoke"
        );
        require(rec.status == RecordStatus.Valid, "Sertifikat sudah dibatalkan atau tidak aktif");

        rec.status = RecordStatus.Revoked;
    }

    // ─────────────────────────────────────────────
    //  METADATA & SVG RENDERER
    // ─────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        VaccineRecord memory rec = records[tokenId];
        
        string memory image = _generateSVG(tokenId, rec);
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "VaxChain #', tokenId.toString(), 
                        '", "description": "Sertifikat Vaksin Digital Terverifikasi", ',
                        '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(image)), 
                        '", "attributes": [{"trait_type": "Vaccine", "value": "', rec.vaccineType, 
                        '"}, {"trait_type": "Issuer", "value": "', rec.facilityName, '"}]}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _generateSVG(uint256 tokenId, VaccineRecord memory rec) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">',
                '<rect width="100%" height="100%" fill="#f8fafc"/>',
                '<rect x="20" y="20" width="360" height="560" rx="15" fill="white" stroke="#10b981" stroke-width="4"/>',
                '<text x="200" y="80" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle" fill="#064e3b">SERTIFIKAT VAKSIN</text>',
                '<line x1="60" y1="100" x2="340" y2="100" stroke="#e2e8f0" stroke-width="2"/>',
                '<text x="200" y="150" font-family="Arial" font-size="14" text-anchor="middle" fill="#64748b">Token ID: #', tokenId.toString(), '</text>',
                '<text x="50" y="220" font-family="Arial" font-size="16" font-weight="bold" fill="#1e293b">Jenis Vaksin:</text>',
                '<text x="50" y="250" font-family="Arial" font-size="18" fill="#0f172a">', rec.vaccineType, '</text>',
                '<text x="50" y="310" font-family="Arial" font-size="16" font-weight="bold" fill="#1e293b">Fasilitas Kesehatan:</text>',
                '<text x="50" y="340" font-family="Arial" font-size="18" fill="#0f172a">', rec.facilityName, '</text>',
                '<rect x="125" y="400" width="150" height="150" fill="#f1f5f9" rx="10"/>',
                '<text x="200" y="470" font-family="Arial" font-size="12" text-anchor="middle" fill="#94a3b8">[ QR CODE PLACEHOLDER ]</text>',
                '<text x="200" y="485" font-family="Arial" font-size="10" text-anchor="middle" fill="#94a3b8">Scan via VaxChain App</text>',
                '</svg>'
            )
        );
    }
}

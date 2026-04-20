// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaccineRegistry
 * @notice DApps Rekam Vaksin Digital Terverifikasi Berbasis Blockchain
 *
 * TAMBAHAN v2:
 * - nikRecords: mapping hash(NIK) → daftar record hash pasien
 * - walletNikHash: 1 wallet = 1 NIK (binding)
 * - nikHashWallet: cegah 1 NIK terikat ke 2 wallet berbeda
 * - bindNik(): pasien ikat wallet ke NIK mereka (sekali saja)
 * - resetNikBinding(): owner/issuer bisa reset jika pasien ganti akun
 * - getRecordsByNik(): pasien ambil semua sertifikat mereka
 */
contract VaccineRegistry {

    // ─────────────────────────────────────────────
    //  TIPE DATA
    // ─────────────────────────────────────────────

    enum RecordStatus {
        NotExists,
        Valid,
        Revoked
    }

    struct VaccineRecord {
        RecordStatus status;
        address      issuer;
        uint256      timestamp;
        string       facilityName;
    }

    // ─────────────────────────────────────────────
    //  STATE VARIABLES
    // ─────────────────────────────────────────────

    address public owner;

    /// Hash rekam vaksin → data rekam
    mapping(bytes32 => VaccineRecord) private records;

    /// Wallet → authorized issuer
    mapping(address => bool)   public authorizedIssuers;
    mapping(address => string) public issuerNames;

    /// NIK mapping: hash(NIK) → daftar record hash milik NIK tersebut
    mapping(bytes32 => bytes32[]) private nikRecords;

    /// NIK Binding: 1 wallet = 1 NIK
    mapping(address => bytes32) public walletNikHash;  // wallet  → hash(NIK)
    mapping(bytes32 => address) public nikHashWallet;  // hash(NIK) → wallet

    uint256 public totalRecords;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event RecordAdded(bytes32 indexed hashData, address indexed issuer, string facilityName, uint256 timestamp);
    event RecordRevoked(bytes32 indexed hashData, address indexed revokedBy, uint256 timestamp);
    event IssuerAuthorized(address indexed issuer, string facilityName);
    event IssuerRemoved(address indexed issuer);
    event NikBound(address indexed wallet, bytes32 indexed nikHash);
    event NikBindingReset(address indexed wallet, bytes32 indexed nikHash, address indexed resetBy);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Hanya owner yang bisa melakukan ini");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedIssuers[msg.sender], "Wallet ini belum terdaftar sebagai fasilitas kesehatan");
        _;
    }

    modifier onlyOwnerOrIssuer() {
        require(
            msg.sender == owner || authorizedIssuers[msg.sender],
            "Hanya owner atau faskes yang bisa melakukan ini"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        issuerNames[msg.sender]       = "Kementerian Kesehatan RI";
        emit IssuerAuthorized(msg.sender, "Kementerian Kesehatan RI");
    }

    // ─────────────────────────────────────────────
    //  FUNGSI ADMIN (hanya owner)
    // ─────────────────────────────────────────────

    function authorizeIssuer(address issuer, string calldata name) external onlyOwner {
        require(issuer != address(0), "Alamat tidak valid");
        require(bytes(name).length > 0, "Nama fasilitas tidak boleh kosong");
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
    //  FUNGSI ISSUER (hanya fasilitas kesehatan)
    // ─────────────────────────────────────────────

    /**
     * @notice Mencatat hash data vaksin ke blockchain
     * @param hashData  keccak256(NIK|vaksin|batch|tanggal|salt)
     * @param nikHash   keccak256(NIK) — untuk mapping ke pasien
     *
     * nikHash memungkinkan pasien melihat semua sertifikat mereka
     * tanpa menyimpan NIK asli di blockchain.
     */
    function addVaccineRecord(bytes32 hashData, bytes32 nikHash) external onlyAuthorized {
        require(records[hashData].status == RecordStatus.NotExists, "Hash ini sudah pernah dicatat");
        require(nikHash != bytes32(0), "NIK hash tidak boleh kosong");

        records[hashData] = VaccineRecord({
            status:       RecordStatus.Valid,
            issuer:       msg.sender,
            timestamp:    block.timestamp,
            facilityName: issuerNames[msg.sender]
        });

        // Tambahkan record ke daftar NIK pasien
        nikRecords[nikHash].push(hashData);

        totalRecords++;

        emit RecordAdded(hashData, msg.sender, issuerNames[msg.sender], block.timestamp);
    }

    function revokeCertificate(bytes32 hashData) external onlyAuthorized {
        require(records[hashData].status == RecordStatus.Valid, "Sertifikat tidak ditemukan atau sudah direvoke");
        records[hashData].status = RecordStatus.Revoked;
        emit RecordRevoked(hashData, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  FUNGSI PASIEN — NIK Binding
    // ─────────────────────────────────────────────

    /**
     * @notice Pasien mengikat wallet mereka ke NIK (sekali saja)
     * @param nikHash  keccak256(NIK) — NIK asli tidak disimpan
     *
     * Syarat:
     * - Wallet belum pernah bind ke NIK manapun
     * - NIK belum terikat ke wallet lain
     */
    function bindNik(bytes32 nikHash) external {
        require(nikHash != bytes32(0), "NIK hash tidak valid");
        require(walletNikHash[msg.sender] == bytes32(0), "Wallet ini sudah terikat ke NIK");
        require(nikHashWallet[nikHash] == address(0), "NIK ini sudah terikat ke wallet lain. Hubungi faskes untuk reset.");

        walletNikHash[msg.sender] = nikHash;
        nikHashWallet[nikHash]    = msg.sender;

        emit NikBound(msg.sender, nikHash);
    }

    /**
     * @notice Reset binding NIK — hanya owner atau issuer
     * @dev Digunakan saat pasien ganti akun Google / lupa akun
     * @param wallet  Alamat wallet yang akan direset
     */
    function resetNikBinding(address wallet) external onlyOwnerOrIssuer {
        bytes32 nikHash = walletNikHash[wallet];
        require(nikHash != bytes32(0), "Wallet ini belum terikat ke NIK manapun");

        nikHashWallet[nikHash] = address(0);
        walletNikHash[wallet]  = bytes32(0);

        emit NikBindingReset(wallet, nikHash, msg.sender);
    }

    // ─────────────────────────────────────────────
    //  FUNGSI PUBLIK (siapa saja bisa panggil)
    // ─────────────────────────────────────────────

    /**
     * @notice Verifikasi keaslian sertifikat vaksin (via hash)
     */
    function verifyRecord(bytes32 hashData)
        external view
        returns (bool isValid, address issuer, string memory facilityName, uint256 timestamp, uint8 statusCode)
    {
        VaccineRecord memory r = records[hashData];
        return (
            r.status == RecordStatus.Valid,
            r.issuer,
            r.facilityName,
            r.timestamp,
            uint8(r.status)
        );
    }

    /**
     * @notice Ambil semua record hash milik satu NIK
     * @param nikHash  keccak256(NIK) dari pasien
     * @return Array hash sertifikat yang dimiliki NIK tersebut
     */
    function getRecordsByNik(bytes32 nikHash) external view returns (bytes32[] memory) {
        return nikRecords[nikHash];
    }

    /**
     * @notice Cek apakah wallet sudah terikat ke NIK
     * @return nikHash bytes32(0) jika belum terikat
     */
    function getNikHashByWallet(address wallet) external view returns (bytes32) {
        return walletNikHash[wallet];
    }

    function isAuthorizedIssuer(address addr) external view returns (bool) {
        return authorizedIssuers[addr];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaccineRegistry
 * @notice DApps Rekam Vaksin Digital Terverifikasi Berbasis Blockchain
 * @dev Menyimpan hash data vaksin, bukan data asli — privasi terjaga
 *
 * CARA KERJA SINGKAT:
 * 1. Owner (deployer) mendaftarkan fasilitas kesehatan sebagai "authorized issuer"
 * 2. Issuer mencatat vaksinasi → data di-hash → hash disimpan di blockchain
 * 3. Siapa saja bisa verifikasi sertifikat tanpa melihat data asli
 */
contract VaccineRegistry {

    // ─────────────────────────────────────────────
    //  TIPE DATA
    // ─────────────────────────────────────────────

    /// Status setiap catatan vaksin
    enum RecordStatus {
        NotExists, // Belum pernah dicatat
        Valid,     // Valid / aktif
        Revoked    // Dibatalkan (salah input / fraud)
    }

    /// Struktur data satu catatan vaksin
    struct VaccineRecord {
        RecordStatus status;    // Status saat ini
        address      issuer;    // Alamat wallet faskes yang mencatat
        uint256      timestamp; // Waktu pencatatan (Unix epoch)
        string       facilityName; // Nama fasilitas kesehatan
    }

    // ─────────────────────────────────────────────
    //  STATE VARIABLES
    // ─────────────────────────────────────────────

    address public owner; // Pemilik kontrak (admin pusat)

    /// Mapping hash → data rekam vaksin
    mapping(bytes32 => VaccineRecord) private records;

    /// Mapping alamat wallet → apakah terdaftar sebagai issuer
    mapping(address => bool) public authorizedIssuers;

    /// Mapping alamat wallet → nama fasilitas kesehatan
    mapping(address => string) public issuerNames;

    /// Total rekam yang pernah dicatat (statistik)
    uint256 public totalRecords;

    // ─────────────────────────────────────────────
    //  EVENTS — dicatat permanen di blockchain log
    // ─────────────────────────────────────────────

    event RecordAdded(
        bytes32 indexed hashData,
        address indexed issuer,
        string  facilityName,
        uint256 timestamp
    );

    event RecordRevoked(
        bytes32 indexed hashData,
        address indexed revokedBy,
        uint256 timestamp
    );

    event IssuerAuthorized(address indexed issuer, string facilityName);
    event IssuerRemoved(address indexed issuer);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Hanya owner yang bisa melakukan ini");
        _;
    }

    modifier onlyAuthorized() {
        require(
            authorizedIssuers[msg.sender],
            "Wallet ini belum terdaftar sebagai fasilitas kesehatan"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        // Owner juga langsung jadi issuer (untuk testing)
        authorizedIssuers[msg.sender] = true;
        issuerNames[msg.sender]       = "Kementerian Kesehatan RI";
        emit IssuerAuthorized(msg.sender, "Kementerian Kesehatan RI");
    }

    // ─────────────────────────────────────────────
    //  FUNGSI ADMIN (hanya owner)
    // ─────────────────────────────────────────────

    /**
     * @notice Mendaftarkan fasilitas kesehatan sebagai authorized issuer
     * @param issuer   Alamat wallet fasilitas kesehatan
     * @param name     Nama fasilitas (misal: "RSUP Dr. Cipto Mangunkusumo")
     */
    function authorizeIssuer(address issuer, string calldata name) external onlyOwner {
        require(issuer != address(0), "Alamat tidak valid");
        require(bytes(name).length > 0, "Nama fasilitas tidak boleh kosong");
        authorizedIssuers[issuer] = true;
        issuerNames[issuer]       = name;
        emit IssuerAuthorized(issuer, name);
    }

    /**
     * @notice Mencabut status authorized issuer
     */
    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    // ─────────────────────────────────────────────
    //  FUNGSI ISSUER (hanya fasilitas kesehatan)
    // ─────────────────────────────────────────────

    /**
     * @notice Mencatat hash data vaksin ke blockchain
     * @param hashData  Hasil keccak256( NIK + jenis_vaksin + kode_produksi + tanggal + salt )
     *
     * CARA GENERATE HASH DI FRONTEND:
     *   const salt = crypto.randomUUID();
     *   const raw  = `${nik}|${jenisVaksin}|${kodeProduksi}|${tanggal}|${salt}`;
     *   const hash = ethers.keccak256(ethers.toUtf8Bytes(raw));
     */
    function addVaccineRecord(bytes32 hashData) external onlyAuthorized {
        require(
            records[hashData].status == RecordStatus.NotExists,
            "Hash ini sudah pernah dicatat"
        );

        records[hashData] = VaccineRecord({
            status:       RecordStatus.Valid,
            issuer:       msg.sender,
            timestamp:    block.timestamp,
            facilityName: issuerNames[msg.sender]
        });

        totalRecords++;

        emit RecordAdded(
            hashData,
            msg.sender,
            issuerNames[msg.sender],
            block.timestamp
        );
    }

    /**
     * @notice Membatalkan / merevoke sertifikat (misal: salah input)
     * @dev Data tidak dihapus dari blockchain, hanya status diubah menjadi Revoked
     */
    function revokeCertificate(bytes32 hashData) external onlyAuthorized {
        require(
            records[hashData].status == RecordStatus.Valid,
            "Sertifikat tidak ditemukan atau sudah direvoke"
        );
        records[hashData].status = RecordStatus.Revoked;
        emit RecordRevoked(hashData, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  FUNGSI PUBLIK (siapa saja bisa panggil)
    // ─────────────────────────────────────────────

    /**
     * @notice Verifikasi keaslian sertifikat vaksin
     * @param hashData  Hash yang ada di sertifikat
     * @return isValid      true jika sertifikat valid
     * @return issuer       Alamat wallet faskes penerbit
     * @return facilityName Nama fasilitas kesehatan penerbit
     * @return timestamp    Waktu pencatatan
     * @return statusCode   0=tidak ada, 1=valid, 2=revoked
     */
    function verifyRecord(bytes32 hashData)
        external
        view
        returns (
            bool    isValid,
            address issuer,
            string  memory facilityName,
            uint256 timestamp,
            uint8   statusCode
        )
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
     * @notice Cek apakah sebuah wallet adalah authorized issuer
     */
    function isAuthorizedIssuer(address addr) external view returns (bool) {
        return authorizedIssuers[addr];
    }
}

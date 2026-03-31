import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  AlertCircle,
  Camera,
  ChevronDown,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  PenTool,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';

// Isi dengan URL Web App dari Google Apps Script jika sudah tersedia.
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL || '';

const HARI_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const STATUS_OPTIONS = ['Hadir', 'Sakit', 'Izin', 'Alpa'];
const STATUS_FILTER_OPTIONS = ['Semua', ...STATUS_OPTIONS];
const JSONP_TIMEOUT_MS = 12000;
const SYNC_MODAL_MIN_DURATION_MS = 700;
const SEED_GURU = [
  'Dra. Euis Erinawati',
  'Rani Khaerani, S.Pd.',
  'Ugi Sugiarti, S.Si.',
  'Enny Mayawati Tamrin, M.Pd.',
  'Firman Fajar, S.Sos.',
  'Sri Winarti, S.Pd.',
];
const SEED_MAPEL = ['BAHASA ARAB', 'BAHASA INDONESIA', 'BAHASA INGGRIS', 'BIOLOGI', 'FISIKA', 'MATEMATIKA'];
const SEED_SISWA = [
  { no: '232410129', nama: 'AHMAD ARIQ ADYLA', ruang: 'S.01' },
  { no: '232410072', nama: 'AOKI MAOLANA', ruang: 'S.01' },
  { no: '232410131', nama: "ARIS SHALAHUDDIN AHMAD SYUJA'", ruang: 'S.01' },
  { no: '232410132', nama: 'ARRA KHAIDIR RIDHA', ruang: 'S.01' },
  { no: '232410097', nama: 'ADINDA AISYAH', ruang: 'R. TIK' },
  { no: '232410098', nama: 'ADZKIA NUR AFIFAH WIRATAMA', ruang: 'R. TIK' },
  { no: '232410099', nama: 'ADZRA ALIA ARRAYYAN', ruang: 'R. TIK' },
];

function getHariIndo(dayIndex) {
  return HARI_INDO[dayIndex] ?? '';
}

function getStatusColor(status) {
  switch (status) {
    case 'Hadir':
      return 'bg-green-500 text-white border-green-600';
    case 'Sakit':
      return 'bg-orange-500 text-white border-orange-600';
    case 'Izin':
      return 'bg-blue-500 text-white border-blue-600';
    case 'Alpa':
      return 'bg-red-500 text-white border-red-600';
    default:
      return 'bg-white text-slate-400 border-slate-200';
  }
}

function getInitialFormData() {
  const now = new Date();
  return {
    tanggal: now.toISOString().split('T')[0],
    hari: getHariIndo(now.getDay()),
    ruang: '',
    mapel: '',
    waktu: '',
    tempat: 'SMA IT NURUL FIKRI',
    pengawas: '',
    catatan: '',
    foto: null,
    paraf: null,
  };
}

function getInitialMasterData() {
  return {
    pengawas: SEED_GURU,
    mapel: SEED_MAPEL,
    ruangList: ['S.01', 'S.02', 'S.03', 'R. TIK', 'R. LAB'],
    semuaSiswa: SEED_SISWA,
  };
}

function normalizeSiswaRow(row) {
  if (!row) return null;

  if (Array.isArray(row)) {
    const [nisn, nama, , rombel] = row;
    if (!nisn || !nama) return null;
    return {
      no: String(nisn).trim(),
      nama: String(nama).trim(),
      ruang: String(rombel || '').trim(),
    };
  }

  const no = row.no ?? row.nisn ?? row.NISN ?? '';
  const nama = row.nama ?? row.NAMA ?? '';
  const ruang = row.ruang ?? row.rombel ?? row.ROMBEL ?? '';

  if (!no || !nama) return null;
  return {
    no: String(no).trim(),
    nama: String(nama).trim(),
    ruang: String(ruang).trim(),
  };
}

function normalizeSimpleValue(row, keys = []) {
  if (row == null) return '';

  if (typeof row === 'string' || typeof row === 'number' || typeof row === 'boolean') {
    return String(row).trim();
  }

  if (Array.isArray(row)) {
    const value = row.find((item) => String(item || '').trim());
    return String(value || '').trim();
  }

  for (const key of keys) {
    const found = row[key] ?? row[key?.toUpperCase()] ?? row[key?.toLowerCase()];
    if (String(found || '').trim()) {
      return String(found).trim();
    }
  }

  const firstValue = Object.values(row).find((item) => String(item || '').trim());
  return String(firstValue || '').trim();
}

function buildMasterSyncHint(mode) {
  return [
    `Sinkron ${mode} gagal.`,
    'Periksa Apps Script doGet(mode) mengembalikan JSON/JSONP, bukan HTML.',
    'Pastikan deployment Web App terbaru sudah di-publish dan akses diset ke Anyone.',
  ].join(' ');
}

function getInitialMasterSyncStatus() {
  return {
    siswa: { status: 'idle', message: 'Belum sinkron', count: 0 },
    mapel: { status: 'idle', message: 'Belum sinkron', count: 0 },
    guru: { status: 'idle', message: 'Belum sinkron', count: 0 },
  };
}

function getSyncBadgeClass(status) {
  if (status === 'success' || status === 'local') {
    return 'border-green-200 bg-green-50 text-green-700';
  }
  if (status === 'loading') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (status === 'error') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function SearchableSelect({ label, value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) => option.toLowerCase().includes(keyword));
  }, [options, query]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <label className="text-[10px] font-bold text-slate-400">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left"
      >
        <span className={`text-sm ${value ? 'text-slate-700' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
                setQuery('');
              }}
              className="mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              {placeholder}
            </button>

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                    value === option ? 'bg-blue-100 font-semibold text-blue-700' : 'text-slate-700'
                  }`}
                >
                  {option}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-slate-400">Data tidak ditemukan.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

SearchableSelect.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired,
};

function loadViaJsonp(scriptUrl, mode, errorMessage) {
  return new Promise((resolve, reject) => {
    const callbackName = `psajMasterCb_${mode}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const join = scriptUrl.includes('?') ? '&' : '?';
    const src = `${scriptUrl}${join}mode=${encodeURIComponent(mode)}&callback=${callbackName}`;
    const script = document.createElement('script');
    let timeoutId = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    };

    const fail = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    window[callbackName] = (response) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (!response || typeof response !== 'object') {
        reject(new Error(`${errorMessage} Respons callback tidak valid.`));
        return;
      }

      if (response.ok === false) {
        reject(new Error(`${errorMessage} ${response.message || ''}`.trim()));
        return;
      }

      resolve(response);
    };

    script.onerror = () => {
      fail(`${errorMessage} ${buildMasterSyncHint(mode)}`);
    };

    timeoutId = window.setTimeout(() => {
      fail(`${errorMessage} Timeout ${JSONP_TIMEOUT_MS / 1000} detik. ${buildMasterSyncHint(mode)}`);
    }, JSONP_TIMEOUT_MS);

    script.src = src;
    script.async = true;
    document.body.appendChild(script);
  });
}

function App() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [masterDataInfo, setMasterDataInfo] = useState('');
  const [masterSyncStatus, setMasterSyncStatus] = useState(getInitialMasterSyncStatus);

  const [masterLoading, setMasterLoading] = useState(false);
  const [masterData, setMasterData] = useState(getInitialMasterData);
  const [formData, setFormData] = useState(getInitialFormData);
  const [attendanceList, setAttendanceList] = useState({});
  const [siswaSearch, setSiswaSearch] = useState('');
  const [siswaStatusFilter, setSiswaStatusFilter] = useState('Semua');

  const sigCanvas = useRef(null);
  const syncModalStartedAtRef = useRef(0);
  const syncModalTimeoutRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    if (syncModalTimeoutRef.current) {
      window.clearTimeout(syncModalTimeoutRef.current);
      syncModalTimeoutRef.current = null;
    }

    if (masterLoading) {
      syncModalStartedAtRef.current = Date.now();
      setShowSyncModal(true);
      return;
    }

    if (!syncModalStartedAtRef.current) {
      setShowSyncModal(false);
      return;
    }

    const elapsed = Date.now() - syncModalStartedAtRef.current;
    const remaining = Math.max(0, SYNC_MODAL_MIN_DURATION_MS - elapsed);

    syncModalTimeoutRef.current = window.setTimeout(() => {
      setShowSyncModal(false);
      syncModalStartedAtRef.current = 0;
      syncModalTimeoutRef.current = null;
    }, remaining);
  }, [masterLoading]);

  useEffect(() => {
    return () => {
      if (syncModalTimeoutRef.current) {
        window.clearTimeout(syncModalTimeoutRef.current);
      }
    };
  }, []);

  const filteredSiswa = useMemo(() => {
    return masterData.semuaSiswa.filter((siswa) => siswa.ruang === formData.ruang);
  }, [formData.ruang, masterData.semuaSiswa]);

  const visibleSiswa = useMemo(() => {
    const keyword = siswaSearch.trim().toLowerCase();
    return filteredSiswa.filter((siswa) => {
      const matchName = !keyword || siswa.nama.toLowerCase().includes(keyword);
      const status = attendanceList[siswa.no] ?? 'Hadir';
      const matchStatus = siswaStatusFilter === 'Semua' || status === siswaStatusFilter;
      return matchName && matchStatus;
    });
  }, [filteredSiswa, siswaSearch, attendanceList, siswaStatusFilter]);

  useEffect(() => {
    let isMounted = true;

    const syncMasterSiswa = async () => {
      if (!SCRIPT_URL) {
        setMasterDataInfo('Mode lokal: menggunakan data siswa bawaan aplikasi.');
        setMasterSyncStatus({
          siswa: { status: 'local', message: 'Data lokal aktif', count: SEED_SISWA.length },
          mapel: { status: 'local', message: 'Data lokal aktif', count: SEED_MAPEL.length },
          guru: { status: 'local', message: 'Data lokal aktif', count: SEED_GURU.length },
        });
        return;
      }

      setMasterLoading(true);
      setMasterSyncStatus({
        siswa: { status: 'loading', message: 'Memuat...', count: 0 },
        mapel: { status: 'loading', message: 'Memuat...', count: 0 },
        guru: { status: 'loading', message: 'Memuat...', count: 0 },
      });

      try {
        const [siswaResult, mapelResult, guruResult] = await Promise.allSettled([
          loadViaJsonp(SCRIPT_URL, 'siswa', 'Gagal memuat data siswa dari Apps Script.'),
          loadViaJsonp(SCRIPT_URL, 'mapel', 'Gagal memuat data mapel dari Apps Script.'),
          loadViaJsonp(SCRIPT_URL, 'guru', 'Gagal memuat data guru dari Apps Script.'),
        ]);

        const nextSync = getInitialMasterSyncStatus();
        const masterPatch = {};
        let successCount = 0;

        if (siswaResult.status === 'fulfilled') {
          const rawSiswa = siswaResult.value?.siswa || siswaResult.value?.data || [];
          const siswa = rawSiswa.map(normalizeSiswaRow).filter(Boolean);

          if (siswa.length) {
            const ruangList = [...new Set(siswa.map((item) => item.ruang).filter(Boolean))];
            masterPatch.semuaSiswa = siswa;
            if (ruangList.length) {
              masterPatch.ruangList = ruangList;
            }
            nextSync.siswa = { status: 'success', message: 'Sinkron berhasil', count: siswa.length };
            successCount += 1;
          } else {
            nextSync.siswa = {
              status: 'error',
              message: 'Data siswa kosong atau format DAFTAR SISWA belum sesuai',
              count: 0,
            };
          }
        } else {
          nextSync.siswa = { status: 'error', message: siswaResult.reason?.message || 'Sinkron gagal', count: 0 };
        }

        if (mapelResult.status === 'fulfilled') {
          const rawMapel = mapelResult.value?.mapel || mapelResult.value?.data || [];
          const mapel = rawMapel
            .map((row) => normalizeSimpleValue(row, ['mapel', 'mata_pelajaran', 'mataPelajaran']))
            .filter(Boolean);

          if (mapel.length) {
            masterPatch.mapel = [...new Set(mapel)];
            nextSync.mapel = { status: 'success', message: 'Sinkron berhasil', count: mapel.length };
            successCount += 1;
          } else {
            nextSync.mapel = { status: 'error', message: 'Sheet MAPEL kosong', count: 0 };
          }
        } else {
          nextSync.mapel = { status: 'error', message: mapelResult.reason?.message || 'Sinkron gagal', count: 0 };
        }

        if (guruResult.status === 'fulfilled') {
          const rawGuru = guruResult.value?.guru || guruResult.value?.data || [];
          const pengawas = rawGuru
            .map((row) => normalizeSimpleValue(row, ['guru', 'nama', 'pengawas']))
            .filter(Boolean);

          if (pengawas.length) {
            masterPatch.pengawas = [...new Set(pengawas)];
            nextSync.guru = { status: 'success', message: 'Sinkron berhasil', count: pengawas.length };
            successCount += 1;
          } else {
            nextSync.guru = { status: 'error', message: 'Sheet GURU kosong', count: 0 };
          }
        } else {
          nextSync.guru = { status: 'error', message: guruResult.reason?.message || 'Sinkron gagal', count: 0 };
        }

        if (isMounted) {
          if (Object.keys(masterPatch).length > 0) {
            setMasterData((prev) => ({ ...prev, ...masterPatch }));
          }
          setMasterSyncStatus(nextSync);

          if (successCount === 3) {
            setMasterDataInfo('Semua master data berhasil sinkron.');
          } else if (successCount > 0) {
            setMasterDataInfo('Sebagian master data berhasil sinkron.');
          } else {
            setMasterDataInfo('Sinkron gagal total. Menggunakan data cadangan aplikasi.');
          }
        }
      } finally {
        if (isMounted) {
          setMasterLoading(false);
        }
      }
    };

    syncMasterSiswa();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const selectedDate = new Date(formData.tanggal);
    if (!Number.isNaN(selectedDate.getTime())) {
      setFormData((prev) => ({ ...prev, hari: getHariIndo(selectedDate.getDay()) }));
    }
  }, [formData.tanggal]);

  useEffect(() => {
    const initialAttendance = {};
    filteredSiswa.forEach((siswa) => {
      initialAttendance[siswa.no] = 'Hadir';
    });
    setAttendanceList(initialAttendance);
    setSiswaSearch('');
    setSiswaStatusFilter('Semua');
  }, [filteredSiswa]);

  const stats = useMemo(() => {
    const values = Object.values(attendanceList);
    return {
      total: values.length,
      hadir: values.filter((v) => v === 'Hadir').length,
      sakit: values.filter((v) => v === 'Sakit').length,
      izin: values.filter((v) => v === 'Izin').length,
      alpa: values.filter((v) => v === 'Alpa').length,
    };
  }, [attendanceList]);

  const updateFormValue = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleStatusChange = (noPeserta, status) => {
    setAttendanceList((prev) => ({ ...prev, [noPeserta]: status }));
  };

  const getCanvasPoint = (event, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event) => {
    if (!sigCanvas.current) return;
    const canvas = sigCanvas.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasPoint(event, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const draw = (event) => {
    if (!isDrawing || !sigCanvas.current) return;
    const canvas = sigCanvas.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasPoint(event, canvas);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || !sigCanvas.current) return;
    setIsDrawing(false);
    updateFormValue('paraf', sigCanvas.current.toDataURL('image/png'));
  };

  const clearSignature = () => {
    if (!sigCanvas.current) return;
    const canvas = sigCanvas.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateFormValue('paraf', null);
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran gambar maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      updateFormValue('foto', reader.result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setFormData(getInitialFormData());
    setAttendanceList({});
    clearSignature();
    setError(null);
    setSuccess(false);
  };

  const validateForm = () => {
    if (!formData.ruang) return 'Mohon pilih ruang ujian.';
    if (!formData.mapel) return 'Mohon pilih mata pelajaran.';
    if (!formData.pengawas) return 'Mohon pilih pengawas.';
    if (!formData.waktu) return 'Mohon isi waktu ujian.';
    if (!formData.foto) return 'Mohon unggah foto ruang.';
    if (!formData.paraf) return 'Mohon isi paraf pengawas.';
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      ...formData,
      ...stats,
      attendanceDetail: filteredSiswa.map((siswa) => ({
        no: siswa.no,
        nama: siswa.nama,
        status: attendanceList[siswa.no] ?? 'Hadir',
      })),
      createdAt: new Date().toISOString(),
    };

    try {
      if (SCRIPT_URL) {
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
        });
      } else {
        const history = JSON.parse(localStorage.getItem('psaj-submissions') || '[]');
        history.push(payload);
        localStorage.setItem('psaj-submissions', JSON.stringify(history));
        await new Promise((resolve) => setTimeout(resolve, 700));
      }

      setSuccess(true);
    } catch (submitError) {
      setError(`Gagal menyimpan data. ${submitError.message || ''}`.trim());
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-green-50 p-6 text-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <CheckCircle2 className="mx-auto mb-4 h-20 w-20 text-green-500" />
          <h2 className="mb-2 text-2xl font-bold text-slate-800">Berhasil Terkirim</h2>
          <p className="mb-6 text-sm text-slate-600">Berita acara dan rekap kehadiran telah disimpan.</p>
          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-700"
          >
            Buat Berita Acara Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10 text-slate-900">
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />
            <h3 className="mt-4 text-lg font-bold text-slate-800">Sinkronisasi Master Data</h3>
            <p className="mt-1 text-sm text-slate-600">Memuat data siswa, mapel, dan guru dari spreadsheet...</p>

            <div className="mt-4 grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
              {[
                { key: 'siswa', label: 'Siswa' },
                { key: 'mapel', label: 'Mapel' },
                { key: 'guru', label: 'Guru' },
              ].map((item) => {
                const source = masterSyncStatus[item.key];
                return (
                  <div
                    key={`overlay-${item.key}`}
                    className={`rounded-lg border px-2 py-2 text-xs ${getSyncBadgeClass(source.status)}`}
                  >
                    <p className="font-bold uppercase">{item.label}</p>
                    <p className="mt-1">{source.message}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-blue-700 p-6 text-white shadow-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <FileText className="h-7 w-7" />
          <h1 className="text-lg font-bold tracking-tight">E-Berita Acara PSAJ</h1>
        </div>
      </header>

      <main className="mx-auto mt-4 max-w-4xl px-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-blue-600">
              <Clock className="h-4 w-4" /> Informasi Ujian
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">TANGGAL</label>
                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={(event) => updateFormValue('tanggal', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400">HARI</label>
                <input
                  type="text"
                  value={formData.hari}
                  readOnly
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400">WAKTU UJIAN</label>
                <input
                  type="text"
                  placeholder="Contoh: 07.30 - 09.30"
                  value={formData.waktu}
                  onChange={(event) => updateFormValue('waktu', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3"
                />
              </div>

              <SearchableSelect
                label="RUANG"
                value={formData.ruang}
                options={masterData.ruangList}
                onChange={(value) => updateFormValue('ruang', value)}
                placeholder="Pilih Ruang"
              />

              <SearchableSelect
                label="MATA PELAJARAN"
                value={formData.mapel}
                options={masterData.mapel}
                onChange={(value) => updateFormValue('mapel', value)}
                placeholder="Pilih Mapel"
              />

              <SearchableSelect
                label="PENGAWAS"
                value={formData.pengawas}
                options={masterData.pengawas}
                onChange={(value) => updateFormValue('pengawas', value)}
                placeholder="Pilih Pengawas"
              />

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400">TEMPAT</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-700">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">{formData.tempat}</span>
                </div>
              </div>
            </div>
          </section>

          {formData.ruang && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-blue-600">
                <Users className="h-4 w-4" /> Rekap Kehadiran (Otomatis)
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'HADIR', val: stats.hadir, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'SAKIT', val: stats.sakit, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'IZIN', val: stats.izin, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'ALPA', val: stats.alpa, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((item) => (
                  <div key={item.label} className={`${item.bg} rounded-xl border border-slate-100 p-2 text-center`}>
                    <p className="mb-1 text-[9px] font-black opacity-60">{item.label}</p>
                    <p className={`text-xl font-black ${item.color}`}>{item.val}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3 text-white">
                <span className="text-xs font-bold">Total Siswa di Ruang {formData.ruang}</span>
                <span className="text-lg font-black">{stats.total}</span>
              </div>
            </section>
          )}

          {formData.ruang && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b bg-slate-50 p-4">
                <h3 className="text-xs font-bold uppercase text-slate-600">Daftar Absensi Siswa</h3>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">
                  {visibleSiswa.length}/{filteredSiswa.length} Orang
                </span>
              </div>

              <div className="border-b bg-white p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={siswaSearch}
                      onChange={(event) => setSiswaSearch(event.target.value)}
                      placeholder="Cari nama siswa..."
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>

                  <select
                    value={siswaStatusFilter}
                    onChange={(event) => setSiswaStatusFilter(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none"
                  >
                    {STATUS_FILTER_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="max-h-[420px] divide-y overflow-y-auto">
                {visibleSiswa.length > 0 ? (
                  visibleSiswa.map((siswa, idx) => (
                    <div
                      key={siswa.no}
                      className="flex flex-col justify-between gap-3 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight">{siswa.nama}</p>
                          <p className="mt-1 font-mono text-[10px] text-slate-400">{siswa.no}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {STATUS_OPTIONS.map((status) => (
                          <button
                            key={`${siswa.no}-${status}`}
                            type="button"
                            onClick={() => handleStatusChange(siswa.no, status)}
                            className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all ${
                              attendanceList[siswa.no] === status
                                ? getStatusColor(status)
                                : 'border-slate-200 bg-white text-slate-400'
                            }`}
                          >
                            {status.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-20" />
                    <p className="text-xs">
                      {filteredSiswa.length > 0
                        ? 'Tidak ada siswa yang cocok dengan kata kunci pencarian.'
                        : 'Data siswa tidak ditemukan di ruang ini.'}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase text-blue-600">Foto Ruang</h3>
              {formData.foto ? (
                <div className="relative aspect-video overflow-hidden rounded-xl border-2 border-blue-500">
                  <img src={formData.foto} alt="Preview Foto Ruang" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => updateFormValue('foto', null)}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:bg-blue-50">
                  <Camera className="mb-2 h-8 w-8 text-slate-300" />
                  <span className="text-[10px] font-bold text-slate-400">Ambil / Pilih Gambar</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                </label>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-blue-600">
                  <PenTool className="h-4 w-4" /> Paraf Pengawas
                </h3>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-500"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>

              <div className="h-[140px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <canvas
                  ref={sigCanvas}
                  width={700}
                  height={220}
                  className="h-full w-full touch-none"
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                />
              </div>
            </section>
          </div>

          <textarea
            placeholder="Tambahkan catatan kejadian luar biasa (jika ada)..."
            className="h-24 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.catatan}
            onChange={(event) => updateFormValue('catatan', event.target.value)}
          />

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">
              <XCircle className="h-4 w-4" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-black text-white shadow-lg transition-all ${
              loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
            }`}
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Save className="h-5 w-5" /> SIMPAN BERITA ACARA
              </>
            )}
          </button>

          {!SCRIPT_URL && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Mode simulasi aktif. Data disimpan sementara di browser. Untuk produksi, isi variabel
              environment <strong>VITE_SCRIPT_URL</strong>.
            </p>
          )}

          {masterDataInfo && (
            <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
              <div className="flex items-center gap-2">
                {masterLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <p className="font-semibold">{masterLoading ? 'Sinkronisasi master data...' : masterDataInfo}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { key: 'siswa', label: 'Siswa' },
                  { key: 'mapel', label: 'Mapel' },
                  { key: 'guru', label: 'Guru' },
                ].map((item) => {
                  const source = masterSyncStatus[item.key];
                  return (
                    <div
                      key={item.key}
                      className={`rounded-lg border px-2 py-2 ${getSyncBadgeClass(source.status)}`}
                    >
                      <p className="font-bold uppercase">{item.label}</p>
                      <p className="mt-1">Status: {source.status}</p>
                      <p>{source.message}</p>
                      {source.count > 0 && <p>Jumlah: {source.count}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </main>

      <footer className="py-8 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
        PSAJ Digital Management System
      </footer>
    </div>
  );
}

export default App;

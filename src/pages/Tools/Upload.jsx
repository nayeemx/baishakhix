import React, { useState, useRef } from "react";
import { addDoc, setDoc, doc, collection, serverTimestamp, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FaFileCsv,
  FaFileUpload,
  FaExchangeAlt,
  FaCopy,
  FaDownload,
  FaFire,
  FaChartLine,
  FaLightbulb,
  FaFileCode
} from 'react-icons/fa';
import { useSelector } from "react-redux";
import { Parser } from "sql-ddl-to-json-schema"; // Add this import
import { parse as pgParse } from "pgsql-ast-parser";
import * as XLSX from "xlsx"; // <-- Add this import

const Upload = () => {
  const [csvText, setCsvText] = useState("");
  const [jsonOutput, setJsonOutput] = useState(null);
  const [error, setError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [conversionType, setConversionType] = useState("csv"); // "csv" or "pgsql" or "pgsql-excel" or "json-excel" or "excel-json"
  const [outputType, setOutputType] = useState("json"); // "json" or "excel"
  const [sqlText, setSqlText] = useState("");
  const [pgsqlError, setPgsqlError] = useState("");
  const [jsonFileText, setJsonFileText] = useState(""); // For JSON to Excel
  const [excelFile, setExcelFile] = useState(null); // For Excel to JSON
  const fileInputRef = useRef(null);
  const excelFileInputRef = useRef(null); // Add this helper to allow separate file input refs for Excel and others
  const darkMode = useSelector((state) => state.theme.darkMode);
  const { user } = useSelector((state) => state.auth); // <-- Add this to get user info
  const [excelReady, setExcelReady] = useState(false); // Track if Excel is ready for download
  const [excelBlobUrl, setExcelBlobUrl] = useState(null); // Store Excel blob URL

  // Animate progress bar from 0 to 100 over given duration (ms)
  const runProgressAnimation = (duration, setProgressFunc, onComplete) => {
    setProgressFunc(0);
    const start = Date.now();
    function animate() {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgressFunc(pct);
      if (pct < 100) {
        setTimeout(animate, 16); // Use setTimeout to avoid blocking UI
      } else {
        onComplete();
      }
    }
    animate();
  };

  const csvToJson = (csv) => {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) {
      setError("CSV should have at least one header row and one data row.");
      return null;
    }
    const headers = lines[0].split(",").map((h) => h.trim());
    const json = [];
    for (let i = 1; i < lines.length; i++) {
      const obj = {};
      const currentLine = lines[i].split(",");
      if (currentLine.length !== headers.length) {
        setError(
          `Row ${i + 1} does not have the same number of columns as the header.`
        );
        return null;
      }
      headers.forEach((header, index) => {
        obj[header] = currentLine[index].trim();
      });
      json.push(obj);
    }
    setError("");
    return json;
  };

  // Parse value helper for pgsql
  const parseValue = (value) => {
    if (value.A_Const?.val?.Integer?.ival !== undefined) {
      return parseInt(value.A_Const.val.Integer.ival);
    }
    if (value.A_Const?.val?.String?.str !== undefined) {
      return value.A_Const.val.String.str;
    }
    if (value.A_Const?.val?.Float?.str !== undefined) {
      return parseFloat(value.A_Const.val.Float.str);
    }
    if (value.A_Const?.val?.Null !== undefined) {
      return null;
    }
    return JSON.stringify(value);
  };

  // PGSQL to JSON conversion using pgsql-ast-parser and custom logic
  const pgsqlToJson = async (sqlText) => {
    try {
      setPgsqlError("");
      // Remove comments, ALTER TYPE ... OWNER TO ..., and COPY ... FROM stdin blocks
      const lines = sqlText.split('\n');
      const filteredLines = [];
      let skipCopy = false;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim().toUpperCase();
        if (trimmed.startsWith('--')) continue;
        if (trimmed.startsWith('ALTER TYPE') && trimmed.includes('OWNER TO')) continue;
        if (trimmed.startsWith('COPY ') && trimmed.includes('FROM STDIN')) {
          skipCopy = true;
          continue;
        }
        if (skipCopy) {
          if (trimmed === '\\.') {
            skipCopy = false;
          }
          continue;
        }
        filteredLines.push(lines[i]);
      }
      const cleanedSql = filteredLines.join('\n');
      // Parse SQL to AST
      let ast;
      try {
        ast = pgParse(cleanedSql);
      } catch (err) {
        setPgsqlError(`Parse error: ${err.message}`);
        return null;
      }
      // Extract INSERT data
      const dataByTable = {};
      for (const stmt of ast) {
        if (stmt.type === "insert") {
          const table = stmt.into.name.name;
          if (!dataByTable[table]) dataByTable[table] = [];
          const columns = stmt.columns?.map(col => col.name) || [];
          for (const row of stmt.values) {
            const obj = {};
            row.forEach((expr, idx) => {
              if (expr.type === "string") obj[columns[idx] || idx] = expr.value;
              else if (expr.type === "integer") obj[columns[idx] || idx] = Number(expr.value);
              else if (expr.type === "numeric") obj[columns[idx] || idx] = Number(expr.value);
              else if (expr.type === "null") obj[columns[idx] || idx] = null;
              else if (expr.type === "boolean") obj[columns[idx] || idx] = expr.value;
              else obj[columns[idx] || idx] = null;
            });
            dataByTable[table].push(obj);
          }
        }
      }
      // If no INSERTs found, try to parse COPY ... FROM stdin blocks manually
      if (Object.keys(dataByTable).length === 0) {
        // Parse COPY blocks
        const copyRegex = /^COPY\s+([^\s(]+)\s*\(([^)]+)\)\s+FROM\s+stdin;/i;
        let i = 0;
        while (i < lines.length) {
          const match = lines[i].match(copyRegex);
          if (match) {
            const table = match[1].replace(/^public\./, "");
            const columns = match[2].split(',').map(s => s.trim());
            i++;
            const rows = [];
            while (i < lines.length && lines[i].trim() !== '\\.') {
              const row = lines[i];
              // Split by tab or by \t or by tab char
              const values = row.split('\t');
              // Convert \N to null
              const obj = {};
              columns.forEach((col, idx) => {
                let val = values[idx];
                if (val === undefined) val = null;
                else if (val === '\\N') val = null;
                else if (/^\d+$/.test(val)) val = Number(val);
                obj[col] = val;
              });
              rows.push(obj);
              i++;
            }
            if (rows.length) {
              if (!dataByTable[table]) dataByTable[table] = [];
              dataByTable[table].push(...rows);
            }
          }
          i++;
        }
      }
      if (Object.keys(dataByTable).length === 0) {
        setPgsqlError("No INSERT or COPY data found in SQL.");
        return null;
      }
      return dataByTable;
    } catch (err) {
      setPgsqlError(`Parse error: ${err.message}`);
      return null;
    }
  };

  // CSV to Excel conversion
  const csvToExcel = (csv, fileName = "data.xlsx") => {
    const json = csvToJson(csv);
    if (!json) return;
    const ws = XLSX.utils.json_to_sheet(json);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    setExcelBlobUrl(url);
    setExcelReady(true);
    return url;
  };

  // PGSQL to Excel conversion (reuse existing logic)
  const pgsqlToExcelAndUrl = async (sqlText, fileName = "pgsql_data.xlsx") => {
    const jsonData = await pgsqlToJson(sqlText);
    if (!jsonData) return;
    const wb = XLSX.utils.book_new();
    Object.entries(jsonData).forEach(([table, rows]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, table);
      }
    });
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    setExcelBlobUrl(url);
    setExcelReady(true);
    return url;
  };

  // JSON to Excel conversion
  const jsonToExcel = (jsonData, fileName = "data.xlsx") => {
    if (!jsonData) return;
    let sheets = {};
    if (typeof jsonData === "object" && !Array.isArray(jsonData)) {
      // If object with tables
      sheets = jsonData;
    } else if (Array.isArray(jsonData)) {
      sheets = { Sheet1: jsonData };
    }
    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([table, rows]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, table);
      }
    });
    XLSX.writeFile(wb, fileName);
  };

  // Excel to JSON conversion
  const excelToJson = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target.result;
        let workbook;
        try {
          workbook = XLSX.read(data, { type: "binary" });
        } catch (e) {
          reject("Failed to parse Excel file.");
          return;
        }
        const result = {};
        workbook.SheetNames.forEach((sheetName) => {
          const roa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
          if (roa.length) result[sheetName] = roa;
        });
        resolve(result);
      };
      reader.onerror = () => reject("Failed to read file.");
      reader.readAsBinaryString(file);
    });
  };

  // Handle file upload for SQL
  const handleSqlFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".sql")) {
      setPgsqlError("Please upload a valid PostgreSQL .sql file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setSqlText(event.target.result);
      setPgsqlError("");
      setJsonOutput(null);
      setShowResult(false);
      setUploadedFileName(file.name.replace(/\.sql$/i, ""));
    };
    reader.readAsText(file);
  };

  // Handle file upload for JSON to Excel
  const handleJsonFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      setError("Please upload a valid JSON file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonFileText(event.target.result);
      setJsonOutput(null);
      setError("");
      setUploadedFileName(file.name.replace(/\.json$/i, ""));
      setShowResult(false);
    };
    reader.readAsText(file);
  };

  // Handle file upload for Excel to JSON
  const handleExcelFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".xls") && !file.name.endsWith(".xlsx")) {
      setError("Please upload a valid Excel (.xls or .xlsx) file.");
      return;
    }
    setExcelFile(file);
    setUploadedFileName(file.name.replace(/\.(xls|xlsx)$/i, ""));
    setShowResult(false);
    setJsonOutput(null);
    setError("");
  };

  // Clean up blob URL on unmount or conversionType/outputType change
  React.useEffect(() => {
    return () => {
      if (excelBlobUrl) URL.revokeObjectURL(excelBlobUrl);
    };
  }, [excelBlobUrl, conversionType, outputType]);

  // Modified handleConvert
  const handleConvert = () => {
    setExcelReady(false);
    setExcelBlobUrl(null);
    if (conversionType === "csv") {
      if (!csvText.trim()) return;
      setConverting(true);
      setShowResult(false);
      setJsonOutput(null);
      runProgressAnimation(2200, setConvertProgress, async () => {
        if (outputType === "json") {
          const jsonData = csvToJson(csvText);
          if (!jsonData) {
            setConverting(false);
            setShowResult(false);
            setJsonOutput(null);
            toast.error("CSV conversion failed.");
            return;
          }
          setJsonOutput(jsonData);
          setShowResult(true);
          setConverting(false);
          toast.success("CSV converted to JSON!");
        } else if (outputType === "excel") {
          const url = csvToExcel(csvText, uploadedFileName ? `${uploadedFileName}.xlsx` : "data.xlsx");
          setShowResult(true);
          setConverting(false);
          toast.success("CSV converted to Excel! Click download.");
        } else {
          setConverting(false);
          setShowResult(false);
          setJsonOutput(null);
          toast.error("Unsupported output type.");
        }
      });
    } else if (conversionType === "pgsql") {
      if (!sqlText.trim()) return;
      setConverting(true);
      setShowResult(false);
      setJsonOutput(null);
      runProgressAnimation(2200, setConvertProgress, async () => {
        if (outputType === "json") {
          const jsonData = await pgsqlToJson(sqlText);
          if (!jsonData) {
            setConverting(false);
            setShowResult(false);
            setJsonOutput(null);
            toast.error("PGSQL conversion failed.");
            return;
          }
          setJsonOutput(jsonData);
          setShowResult(true);
          setConverting(false);
          toast.success("PGSQL converted to JSON!");
        } else if (outputType === "excel") {
          await pgsqlToExcelAndUrl(sqlText, uploadedFileName ? `${uploadedFileName}.xlsx` : "pgsql_data.xlsx");
          setShowResult(true);
          setConverting(false);
          toast.success("PGSQL converted to Excel! Click download.");
        } else {
          setConverting(false);
          setShowResult(false);
          setJsonOutput(null);
          toast.error("Unsupported output type.");
        }
      });
    } else if (conversionType === "pgsql-excel") {
      if (!sqlText.trim()) return;
      setConverting(true);
      setShowResult(false);
      setJsonOutput(null);
      runProgressAnimation(2200, setConvertProgress, async () => {
        const wb = await pgsqlToExcel(sqlText);
        if (!wb) {
          setConverting(false);
          setShowResult(false);
          setJsonOutput(null);
          setPgsqlError("Unable to convert to Excel.");
          toast.error("PGSQL to Excel conversion failed."); // Ensure error toast
          return;
        }
        XLSX.writeFile(wb, uploadedFileName ? `${uploadedFileName}.xlsx` : "pgsql_data.xlsx");
        setConverting(false);
        setShowResult(false);
        toast.success("Excel file downloaded.");
      });
    } else if (conversionType === "json-excel") {
      if (!jsonFileText.trim()) return;
      setConverting(true);
      setShowResult(false);
      setJsonOutput(null);
      runProgressAnimation(1200, setConvertProgress, async () => {
        let parsed;
        try {
          parsed = JSON.parse(jsonFileText);
        } catch (e) {
          setError("Invalid JSON format.");
          setConverting(false);
          toast.error("Invalid JSON format.");
          return;
        }
        setJsonOutput(parsed);
        setShowResult(true);
        setConverting(false);
        jsonToExcel(parsed, uploadedFileName ? `${uploadedFileName}.xlsx` : "data.xlsx");
        toast.success("Excel file downloaded.");
      });
    } else if (conversionType === "excel-json") {
      if (!excelFile) return;
      setConverting(true);
      setShowResult(false);
      setJsonOutput(null);
      runProgressAnimation(1200, setConvertProgress, async () => {
        try {
          const jsonData = await excelToJson(excelFile);
          setJsonOutput(jsonData);
          setShowResult(true);
          setConverting(false);
          toast.success("Excel converted to JSON!");
        } catch (e) {
          setError(typeof e === "string" ? e : "Failed to convert Excel to JSON.");
          setConverting(false);
          toast.error("Failed to convert Excel to JSON.");
        }
      });
    }
  };

  // Download Excel handler
  const handleDownloadExcel = () => {
    if (excelBlobUrl) {
      const a = document.createElement("a");
      a.href = excelBlobUrl;
      a.download = uploadedFileName ? `${uploadedFileName}.xlsx` : "data.xlsx";
      a.click();
    }
  };

  const handleDownload = () => {
    if (!jsonOutput) return;
    const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
      setJsonOutput(null);
      setError("");
      const nameWithoutExt = file.name.replace(/\.csv$/i, "");
      setUploadedFileName(nameWithoutExt);
      setShowResult(false);
    };
    reader.readAsText(file);
  };

  // Dummy stats for UI (replace with Firestore stats if needed)
  const [stats, setStats] = useState({
    thisMonth: 0,
    averageSize: 0,
    total: 0,
  });

  // Fetch usage statistics from uploads meta data in real time
  React.useEffect(() => {
    const uploadsRef = collection(firestore, "uploads");
    const unsubscribe = onSnapshot(uploadsRef, (snapshot) => {
      let total = 0;
      let totalSize = 0;
      let thisMonth = 0;
      const now = new Date();
      const thisMonthNum = now.getMonth();
      const thisYear = now.getFullYear();

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.convertedAt && data.fileSize) {
          total++;
          totalSize += data.fileSize;
          const convertedAt = data.convertedAt.toDate ? data.convertedAt.toDate() : new Date(data.convertedAt.seconds * 1000);
          if (
            convertedAt.getMonth() === thisMonthNum &&
            convertedAt.getFullYear() === thisYear
          ) {
            thisMonth++;
          }
        }
      });

      setStats({
        thisMonth,
        averageSize: total > 0 ? (totalSize / total / (1024 * 1024)).toFixed(2) : 0,
        total,
      });
    });

    return () => unsubscribe();
  }, []);

  // Add this function if missing
  const copyToClipboard = () => {
    if (!jsonOutput) return;
    navigator.clipboard
      .writeText(JSON.stringify(jsonOutput, null, 2))
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Copy failed"));
  };

  // Add this function if missing
  const handleUploadToFirestore = async () => {
    if (!jsonOutput || !uploadedFileName) {
      toast.error("No converted JSON data or filename to upload.");
      return;
    }
    if (!user || !user.uid) {
      toast.error("You must be logged in to upload.");
      return;
    }
    setUploading(true);
    runProgressAnimation(2500, setUploadProgress, async () => {
      try {
        const dataCollection = collection(firestore, uploadedFileName);
        if (typeof jsonOutput === "object" && !Array.isArray(jsonOutput)) {
          for (const table in jsonOutput) {
            const rows = jsonOutput[table];
            if (Array.isArray(rows)) {
              for (const row of rows) {
                await addDoc(dataCollection, row);
              }
            }
          }
        } else if (Array.isArray(jsonOutput)) {
          for (const row of jsonOutput) {
            await addDoc(dataCollection, row);
          }
        }
        toast.success(
          `Uploaded JSON data to Firestore collection: ${uploadedFileName}`
        );
      } catch (err) {
        toast.error(`Upload failed: ${err.message}`);
      }
      setUploading(false);
    });
  };

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900" : "bg-gray-200"}`}>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-center mb-2">
          CSV to JSON Converter
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Convert your CSV or PostgreSQL data to JSON format with ease
        </p>

        {/* Conversion type dropdown */}
        <div className="flex flex-col md:flex-row justify-center mb-8 gap-4">
          <select
            className="px-4 py-2 rounded border border-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
            value={conversionType}
            onChange={e => {
              setConversionType(e.target.value);
              setError("");
              setPgsqlError("");
              setShowResult(false);
              setJsonOutput(null);
              setCsvText("");
              setSqlText("");
              setJsonFileText("");
              setExcelFile(null);
              setUploadedFileName("");
            }}
            disabled={converting || uploading}
          >
            <option value="csv">CSV to JSON</option>
            <option value="pgsql">PGsql to JSON</option>
            <option value="pgsql-excel">PGsql EXCEL (.xls file)</option>
            <option value="json-excel">JSON to EXCEL (.xlsx file)</option>
            <option value="excel-json">EXCEL (.xls file) to JSON</option>
          </select>
          {/* Output type dropdown, only for JSON-producing conversions */}
          {(conversionType === "csv" || conversionType === "pgsql") && (
            <select
              className="px-4 py-2 rounded border border-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
              value={outputType}
              onChange={e => setOutputType(e.target.value)}
              disabled={converting || uploading}
            >
              <option value="json">Output: JSON</option>
              <option value="excel">Output: Excel (.xlsx)</option>
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input */}
          <div className={`rounded-xl p-6 shadow-lg ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              {conversionType === "csv" ? (
                <FaFileCsv className={`mr-2 ${darkMode ? "text-red-400" : "text-red-500" }`} />
              ) : (
                <FaFileCode className={`mr-2 ${darkMode ? "text-red-400" : "text-red-500" }`} />
              )}
              {conversionType === "csv"
                ? "Input CSV Data"
                : conversionType === "pgsql"
                  ? "Input PostgreSQL SQL Dump"
                  : conversionType === "pgsql-excel"
                    ? "Input PostgreSQL SQL Dump for Excel"
                    : conversionType === "json-excel"
                      ? "Input JSON Data for Excel"
                      : "Input Excel File for JSON"}
            </h2>
            {/* Inline error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/90 text-white rounded flex items-center justify-between">
                <span>{error}</span>
                <button
                  className="ml-4 px-2 py-1 rounded bg-red-700 hover:bg-red-800 text-xs"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
            )}
            {conversionType === "pgsql" && pgsqlError && (
              <div className="mb-4 p-3 bg-red-500/90 text-white rounded flex items-center justify-between">
                <span>{pgsqlError}</span>
                <button
                  className="ml-4 px-2 py-1 rounded bg-red-700 hover:bg-red-800 text-xs"
                  onClick={() => setPgsqlError("")}
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* CSV input */}
            {conversionType === "csv" && (
              <>
                <textarea
                  className={`w-full h-64 p-4 rounded-lg border-none focus:ring-2 outline-none resize-none font-mono text-sm ${darkMode ? "bg-gray-700 text-white focus:ring-red-500" : "bg-gray-200 text-gray-800"}`}
                  placeholder="Paste your CSV data here..."
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    setShowResult(false);
                    setJsonOutput(null);
                    setUploadedFileName("");
                    setError("");
                  }}
                  disabled={converting || uploading}
                />
                <div className="mt-4">
                  <p className={`mb-2 ${darkMode ? "text-gray-200" : "text-slate-700"}`}>Or upload a CSV file:</p>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer flex items-center gap-4 hover:border-red-400 transition-colors duration-300 ${
                      converting || uploading
                        ? "border-gray-600 cursor-not-allowed"
                        : "border-gray-600"
                    }`}
                    onClick={() => !converting && !uploading && fileInputRef.current?.click()}
                  >
                    <FaFileUpload className="text-4xl text-red-500" />
                    <p className={`${darkMode ? "text-gray-200" : "text-slate-700"}`}>
                      Drag & drop your CSV file here, or click to browse
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".csv"
                      onChange={handleFileUpload}
                      id="csv-upload"
                      disabled={converting || uploading}
                    />
                  </div>
                  {/* Show selected file name if CSV file is uploaded */}
                  {uploadedFileName && csvText && (
                    <div className="mt-2 text-green-600 text-sm">
                      Selected file: {uploadedFileName}.csv
                    </div>
                  )}
                </div>
              </>
            )}

            {/* PGSQL input */}
            {(conversionType === "pgsql" || conversionType === "pgsql-excel") && (
              <>
                <div className="mb-4 p-3 bg-yellow-200 text-yellow-900 rounded">
                  <strong>Note:</strong> Only simple INSERT/COPY statements are supported. For best results, export your data as CSV from PostgreSQL and use the CSV to JSON converter.
                </div>
                <textarea
                  className={`w-full h-64 p-4 rounded-lg border-none focus:ring-2 outline-none resize-none font-mono text-sm ${darkMode ? "bg-gray-700 text-white focus:ring-red-500" : "bg-gray-200 text-gray-800"}`}
                  placeholder="Paste your PostgreSQL SQL dump here..."
                  value={sqlText}
                  onChange={(e) => {
                    setSqlText(e.target.value);
                    setShowResult(false);
                    setJsonOutput(null);
                    setUploadedFileName("");
                    setPgsqlError("");
                  }}
                  disabled={converting || uploading}
                />
                <div className="mb-2 text-gray-400 text-sm">
                  {sqlText.length > 10_000_000 && (
                    <p className="text-yellow-500 mb-2">
                      ⚠️ Large files may cause performance issues in browser
                    </p>
                  )}
                  Upload a PostgreSQL .sql file containing INSERT or COPY statements
                </div>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer flex items-center gap-4 hover:border-red-400 transition-colors duration-300 ${
                    converting || uploading
                      ? "border-gray-600 cursor-not-allowed"
                      : "border-gray-600"
                  }`}
                  onClick={() => !converting && !uploading && fileInputRef.current?.click()}
                >
                  <FaFileUpload className="text-4xl text-red-500" />
                  <p className={`${darkMode ? "text-gray-200" : "text-slate-700"}`}>
                    Drag & drop your .sql file here, or click to browse
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".sql"
                    onChange={handleSqlFileUpload}
                    id="sql-upload"
                    disabled={converting || uploading}
                  />
                </div>
              </>
            )}

            {/* JSON to Excel input */}
            {conversionType === "json-excel" && (
              <>
                <textarea
                  className={`w-full h-64 p-4 rounded-lg border-none focus:ring-2 outline-none resize-none font-mono text-sm ${darkMode ? "bg-gray-700 text-white focus:ring-red-500" : "bg-gray-200 text-gray-800"}`}
                  placeholder="Paste your JSON data here..."
                  value={jsonFileText}
                  onChange={e => {
                    setJsonFileText(e.target.value);
                    setShowResult(false);
                    setJsonOutput(null);
                    setUploadedFileName("");
                    setError("");
                  }}
                  disabled={converting || uploading}
                />
                <div className="mt-4">
                  <p className={`mb-2 ${darkMode ? "text-gray-200" : "text-slate-700"}`}>Or upload a JSON file:</p>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer flex items-center gap-4 hover:border-red-400 transition-colors duration-300 ${
                      converting || uploading
                        ? "border-gray-600 cursor-not-allowed"
                        : "border-gray-600"
                    }`}
                    onClick={() => !converting && !uploading && fileInputRef.current?.click()}
                  >
                    <FaFileUpload className="text-4xl text-red-500" />
                    <p className={`${darkMode ? "text-gray-200" : "text-slate-700"}`}>
                      Drag & drop your JSON file here, or click to browse
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".json"
                      onChange={handleJsonFileUpload}
                      id="json-upload"
                      disabled={converting || uploading}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Excel to JSON input */}
            {conversionType === "excel-json" && (
              <>
                <div className="mb-4 p-3 bg-blue-100 text-blue-900 rounded">
                  <strong>Note:</strong> Upload an Excel (.xls or .xlsx) file to convert it to JSON. You can upload the resulting JSON to Firestore.
                </div>
                <div className="mt-4">
                  <p className={`mb-2 ${darkMode ? "text-gray-200" : "text-slate-700"}`}>Upload an Excel file:</p>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer flex items-center gap-4 hover:border-blue-400 transition-colors duration-300 ${
                      converting || uploading
                        ? "border-gray-600 cursor-not-allowed"
                        : "border-gray-600"
                    }`}
                    onClick={() => !converting && !uploading && excelFileInputRef.current?.click()}
                  >
                    <FaFileUpload className="text-4xl text-blue-500" />
                    <p className={`${darkMode ? "text-gray-200" : "text-slate-700"}`}>
                      Drag & drop your Excel file here, or click to browse
                    </p>
                    <input
                      type="file"
                      ref={excelFileInputRef}
                      className="hidden"
                      accept=".xls,.xlsx"
                      onChange={handleExcelFileUpload}
                      id="excel-upload"
                      disabled={converting || uploading}
                    />
                  </div>
                  {excelFile && (
                    <div className="mt-2 text-green-600 text-sm">
                      Selected file: {excelFile.name}
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              className="mt-6 w-full py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-400 transition-all duration-300 font-medium flex items-center justify-center whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleConvert}
              disabled={
                (conversionType === "csv" && (!csvText.trim() || converting || uploading)) ||
                ((conversionType === "pgsql" || conversionType === "pgsql-excel") && (!sqlText.trim() || converting || uploading)) ||
                (conversionType === "json-excel" && (!jsonFileText.trim() || converting || uploading)) ||
                (conversionType === "excel-json" && (!excelFile || converting || uploading))
              }
              title={
                conversionType === "csv"
                  ? (!csvText.trim() ? "Paste or upload CSV data first" : undefined)
                  : (conversionType === "pgsql" || conversionType === "pgsql-excel")
                    ? (!sqlText.trim() ? "Paste or upload SQL data first" : undefined)
                    : (conversionType === "json-excel")
                      ? (!jsonFileText.trim() ? "Paste or upload JSON data first" : undefined)
                      : (!excelFile ? "Upload Excel file first" : undefined)
              }
            >
              <FaExchangeAlt className="mr-2" />
              {conversionType === "pgsql-excel" || conversionType === "json-excel"
                ? "Convert to Excel"
                : "Convert to JSON"}
            </button>

            {/* Conversion Progress bar under Convert button */}
            {converting && (
              <div className="mt-4 h-2 w-full bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-200 ease-out"
                  style={{ width: `${convertProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Output */}
          {(conversionType !== "pgsql-excel" && conversionType !== "json-excel") && (
            <div className={`rounded-xl p-6 shadow-lg flex flex-col ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <FaFileCode className={`mr-2 ${darkMode ? "text-red-400" : "text-red-500" }`} />
                {outputType === "excel" ? "Excel Output" : "JSON Output"}
              </h2>

              {outputType === "json" ? (
                <textarea
                  readOnly
                  className={`w-full h-64 p-4 rounded-lg border-none resize-none font-mono text-sm ${darkMode ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-800"}`}
                  value={
                    showResult && jsonOutput
                      ? JSON.stringify(jsonOutput, null, 2)
                      : ""
                  }
                  placeholder="Converted JSON will appear here..."
                />
              ) : (
                <div className="w-full h-64 flex items-center justify-center text-gray-400 italic">
                  {showResult && excelReady ? (
                    <button
                      onClick={handleDownloadExcel}
                      className="px-5 py-2 rounded-lg font-semibold flex items-center gap-2 border border-green-400 hover:bg-green-600 transition text-green-700 bg-green-100"
                    >
                      <FaDownload /> Download Excel
                    </button>
                  ) : (
                    "Converted Excel will be available for download."
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                {outputType === "json" ? (
                  <>
                    <button
                      onClick={handleDownload}
                      disabled={!showResult || converting || uploading}
                      className={`px-5 py-2 rounded-lg font-semibold flex items-center gap-2 border border-red-400 hover:bg-red-600 transition ${
                        !showResult || converting || uploading
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      title={!showResult ? "Convert first" : undefined}
                    >
                      <FaDownload /> JSON
                    </button>
                    <button
                      onClick={copyToClipboard}
                      disabled={!showResult || converting || uploading}
                      className={`px-5 py-2 rounded-lg font-semibold flex items-center gap-2 border border-red-400 hover:bg-red-600 transition ${
                        !showResult || converting || uploading
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      title={!showResult ? "Convert first" : undefined}
                    >
                      <FaCopy /> JSON
                    </button>
                    <button
                      onClick={handleUploadToFirestore}
                      disabled={!showResult || uploading || converting}
                      className={`px-5 py-2 rounded-lg font-semibold flex items-center gap-2 border border-red-400 hover:bg-red-600 transition ${
                        !showResult || uploading || converting
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      title={!showResult ? "Convert first" : undefined}
                    >
                      <FaFire /> Firestore
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleDownloadExcel}
                    disabled={!showResult || converting || uploading}
                    className={`px-5 py-2 rounded-lg font-semibold flex items-center gap-2 border border-green-400 hover:bg-green-600 transition ${
                      !showResult || converting || uploading
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                    title={!showResult ? "Convert first" : undefined}
                  >
                    <FaDownload /> Excel
                  </button>
                )}
              </div>

              {/* Upload Progress bar under Upload button */}
              {uploading && (
                <div className="mt-4 h-2 w-full bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-200 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Usage Statistics */}
        <div className={`mt-12 rounded-xl p-6 shadow-lg ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <FaChartLine className={`mr-2 ${darkMode ? "text-red-400" : "text-red-500" }`} />
            Your Usage Statistics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`rounded-lg p-4 ${darkMode ? "bg-gray-700" : "bg-gray-200" }`}>
              <p className="text-gray-400 text-sm">Conversions This Month</p>
              <p className="text-3xl font-bold mt-2">{stats.thisMonth}</p>
            </div>
            <div className={`rounded-lg p-4 ${darkMode ? "bg-gray-700" : "bg-gray-200" }`}>
              <p className="text-gray-400 text-sm">Average File Size</p>
              <p className="text-3xl font-bold mt-2">{stats.averageSize} MB</p>
            </div>
            <div className={`rounded-lg p-4 ${darkMode ? "bg-gray-700" : "bg-gray-200" }`}>
              <p className="text-gray-400 text-sm">Total Conversions</p>
              <p className="text-3xl font-bold mt-2">{stats.total}</p>
            </div>
          </div>
        </div>

        {/* Tips for Better Conversion */}
        <div className={`mt-12 p-6 rounded-xl shadow-lg ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h3 className="text-lg font-semibold mb-3 text-red-400 flex items-center">
            <FaLightbulb className="mr-2 text-amber-300" /> Tips for Better Conversion
          </h3>
          <ul className={`list-disc list-inside space-y-1 text-sm ${darkMode ? "text-gray-100" : "text-gray-600" }`}>
            <li>Ensure your CSV has headers in the first row</li>
            <li>Check for any special characters that might need escaping</li>
            <li>
              For large files, consider splitting them into smaller chunks
            </li>
            <li>
              Make sure your CSV is properly formatted with consistent
              delimiters
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Upload;
import React, { useState, useRef } from "react";
import { addDoc, collection, serverTimestamp, onSnapshot } from "firebase/firestore";
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
import * as XLSX from "xlsx";
import { parse } from "pgsql-ast-parser"; // Import the parser

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
  const [conversionType, setConversionType] = useState("csv");
  const [outputType, setOutputType] = useState("json");
  const [sqlText, setSqlText] = useState("");
  const [pgsqlError, setPgsqlError] = useState("");
  const [jsonFileText, setJsonFileText] = useState("");
  const [excelFile, setExcelFile] = useState(null);
  const fileInputRef = useRef(null);
  const excelFileInputRef = useRef(null);
  const darkMode = useSelector((state) => state.theme.darkMode);
  const { user } = useSelector((state) => state.auth);
  const [excelReady, setExcelReady] = useState(false);
  const [excelBlobUrl, setExcelBlobUrl] = useState(null);

  // Animate progress bar from 0 to 100 over given duration (ms)
  const runProgressAnimation = (duration, setProgressFunc, onComplete) => {
    setProgressFunc(0);
    const start = Date.now();
    function animate() {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgressFunc(pct);
      if (pct < 100) {
        setTimeout(animate, 16);
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

  const csvToExcel = (csv, fileName = "data.xlsx") => {
    const json = csvToJson(csv);
    if (!json) return null;
    const ws = XLSX.utils.json_to_sheet(json);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    setExcelBlobUrl(url);
    setExcelReady(true);
    return { url, blob };
  };

  const jsonToExcel = (jsonData, fileName = "data.xlsx") => {
    if (!jsonData) return;
    let sheets = {};
    if (typeof jsonData === "object" && !Array.isArray(jsonData)) {
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

  // Basic PostgreSQL to JSON conversion for INSERT statements
  const pgsqlToJson = (sqlText) => {
    try {
      const ast = parse(sqlText);
      const jsonData = [];
      ast.forEach(statement => {
        if (statement.type === 'insert' && statement.table && statement.rows) {
          const tableName = statement.table.name;
          statement.rows.forEach(row => {
            const rowData = {};
            statement.columns.forEach((col, index) => {
              rowData[col.name] = row[index].value;
            });
            jsonData.push({ [tableName]: rowData });
          });
        }
      });
      return jsonData.length > 0 ? jsonData : null;
    } catch (e) {
      setPgsqlError(`Failed to parse PostgreSQL SQL: ${e.message}`);
      return null;
    }
  };

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

  React.useEffect(() => {
    return () => {
      if (excelBlobUrl) URL.revokeObjectURL(excelBlobUrl);
    };
  }, [excelBlobUrl, conversionType, outputType]);

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
          // Save metadata to Firestore
          if (user && user.uid && uploadedFileName) {
            try {
              const uploadsMetaCollection = collection(firestore, "uploads");
              const jsonString = JSON.stringify(jsonData);
              const fileSize = new Blob([jsonString]).size;
              const userName = user.displayName || user.uid;
              if (fileSize !== undefined) {
                await addDoc(uploadsMetaCollection, {
                  fileName: uploadedFileName,
                  fileSize: fileSize,
                  convertedAt: serverTimestamp(),
                  userName: userName,
                  conversionType: conversionType,
                  outputType: outputType
                });
                toast.success("CSV converted to JSON and metadata saved!");
              } else {
                toast.error("CSV converted to JSON, but metadata save failed due to invalid size.");
              }
            } catch (err) {
              console.error("Failed to save metadata:", err);
              toast.error("CSV converted to JSON, but metadata save failed.");
            }
          } else {
            toast.success("CSV converted to JSON!");
          }
        } else if (outputType === "excel") {
          const result = csvToExcel(csvText, uploadedFileName ? `${uploadedFileName}.xlsx` : "data.xlsx");
          if (!result || !result.url) {
            setConverting(false);
            setShowResult(false);
            setJsonOutput(null);
            toast.error("CSV to Excel conversion failed.");
            return;
          }
          setExcelBlobUrl(result.url);
          setShowResult(true);
          setConverting(false);
          // Save metadata to Firestore
          if (user && user.uid && uploadedFileName) {
            try {
              const uploadsMetaCollection = collection(firestore, "uploads");
              const fileSize = result.blob.size;
              const userName = user.displayName || user.uid;
              if (fileSize !== undefined) {
                await addDoc(uploadsMetaCollection, {
                  fileName: uploadedFileName,
                  fileSize: fileSize,
                  convertedAt: serverTimestamp(),
                  userName: userName,
                  conversionType: conversionType,
                  outputType: outputType
                });
                toast.success("CSV converted to Excel and metadata saved! Click download.");
              } else {
                toast.error("CSV converted to Excel, but metadata save failed due to invalid size. Click download.");
              }
            } catch (err) {
              console.error("Failed to save metadata:", err);
              toast.error("CSV converted to Excel, but metadata save failed. Click download.");
            }
          } else {
            toast.success("CSV converted to Excel! Click download.");
          }
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
        const jsonData = pgsqlToJson(sqlText);
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
        // Save metadata to Firestore
        if (user && user.uid && uploadedFileName) {
          try {
            const uploadsMetaCollection = collection(firestore, "uploads");
            const jsonString = JSON.stringify(jsonData);
            const fileSize = new Blob([jsonString]).size;
            const userName = user.displayName || user.uid;
            if (fileSize !== undefined) {
              await addDoc(uploadsMetaCollection, {
                fileName: uploadedFileName,
                fileSize: fileSize,
                convertedAt: serverTimestamp(),
                userName: userName,
                conversionType: conversionType,
                outputType: outputType
              });
              toast.success("PGSQL converted to JSON and metadata saved!");
            } else {
              toast.error("PGSQL converted to JSON, but metadata save failed due to invalid size.");
            }
          } catch (err) {
            console.error("Failed to save metadata:", err);
            toast.error("PGSQL converted to JSON, but metadata save failed.");
          }
        } else {
          toast.success("PGSQL converted to JSON!");
        }
      });
    } else if (conversionType === "pgsql-excel") {
      if (!sqlText.trim()) return;
      setConverting(true);
      setShowResult(false);
      setJsonOutput(null);
      runProgressAnimation(2200, setConvertProgress, async () => {
        const jsonData = pgsqlToJson(sqlText);
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
        const result = csvToExcel(JSON.stringify(jsonData), uploadedFileName ? `${uploadedFileName}.xlsx` : "data.xlsx");
        if (!result || !result.url) {
          setConverting(false);
          setShowResult(false);
          setJsonOutput(null);
          toast.error("PGSQL to Excel conversion failed.");
          return;
        }
        setExcelBlobUrl(result.url);
        // Save metadata to Firestore
        if (user && user.uid && uploadedFileName) {
          try {
            const uploadsMetaCollection = collection(firestore, "uploads");
            const fileSize = result.blob.size;
            const userName = user.displayName || user.uid;
            if (fileSize !== undefined) {
              await addDoc(uploadsMetaCollection, {
                fileName: uploadedFileName,
                fileSize: fileSize,
                convertedAt: serverTimestamp(),
                userName: userName,
                conversionType: conversionType,
                outputType: "excel"
              });
              toast.success("PGSQL converted to Excel and metadata saved! Click download.");
            } else {
              toast.error("PGSQL converted to Excel, but metadata save failed due to invalid size. Click download.");
            }
          } catch (err) {
            console.error("Failed to save metadata:", err);
            toast.error("PGSQL converted to Excel, but metadata save failed. Click download.");
          }
        } else {
          toast.success("PGSQL converted to Excel! Click download.");
        }
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
        // Save metadata to Firestore
        if (user && user.uid && uploadedFileName) {
          try {
            const uploadsMetaCollection = collection(firestore, "uploads");
            const jsonString = JSON.stringify(parsed);
            const fileSize = new Blob([jsonString]).size;
            const userName = user.displayName || user.uid;
            if (fileSize !== undefined) {
              await addDoc(uploadsMetaCollection, {
                fileName: uploadedFileName,
                fileSize: fileSize,
                convertedAt: serverTimestamp(),
                userName: userName,
                conversionType: conversionType,
                outputType: outputType
              });
              toast.success("JSON converted to Excel and metadata saved!");
            } else {
              toast.error("JSON converted to Excel, but metadata save failed due to invalid size.");
            }
          } catch (err) {
            console.error("Failed to save metadata:", err);
            toast.error("JSON converted to Excel, but metadata save failed.");
          }
        } else {
          toast.success("JSON converted to Excel!");
        }
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
          // Save metadata to Firestore
          if (user && user.uid && uploadedFileName) {
            try {
              const uploadsMetaCollection = collection(firestore, "uploads");
              const jsonString = JSON.stringify(jsonData);
              const fileSize = new Blob([jsonString]).size;
              const userName = user.displayName || user.uid;
              if (fileSize !== undefined) {
                await addDoc(uploadsMetaCollection, {
                  fileName: uploadedFileName,
                  fileSize: fileSize,
                  convertedAt: serverTimestamp(),
                  userName: userName,
                  conversionType: conversionType,
                  outputType: outputType
                });
                toast.success("Excel converted to JSON and metadata saved!");
              } else {
                toast.error("Excel converted to JSON, but metadata save failed due to invalid size.");
              }
            } catch (err) {
              console.error("Failed to save metadata:", err);
              toast.error("Excel converted to JSON, but metadata save failed.");
            }
          } else {
            toast.success("Excel converted to JSON!");
          }
        } catch (e) {
          setError(typeof e === "string" ? e : "Failed to convert Excel to JSON.");
          setConverting(false);
          toast.error("Failed to convert Excel to JSON.");
        }
      });
    }
  };

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

  const [stats, setStats] = useState({
    thisMonth: 0,
    averageSize: 0,
    total: 0,
  });

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

  const copyToClipboard = () => {
    if (!jsonOutput) return;
    navigator.clipboard
      .writeText(JSON.stringify(jsonOutput, null, 2))
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Copy failed"));
  };

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
                  {uploadedFileName && csvText && (
                    <div className="mt-2 text-green-600 text-sm">
                      Selected file: {uploadedFileName}.csv
                    </div>
                  )}
                </div>
              </>
            )}

            {(conversionType === "pgsql" || conversionType === "pgsql-excel") && (
              <>
                <div className="mb-4 p-3 bg-yellow-200 text-yellow-900 rounded">
                  <strong>Note:</strong> Only simple INSERT statements are supported. For best results, ensure your SQL dump contains valid INSERT syntax.
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
                  Upload a PostgreSQL .sql file containing INSERT statements
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

            {converting && (
              <div className="mt-4 h-2 w-full bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-200 ease-out"
                  style={{ width: `${convertProgress}%` }}
                />
              </div>
            )}
          </div>

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
            <li>For PGSQL, use valid INSERT statements in your SQL dump</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Upload;
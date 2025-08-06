import React, { useState } from 'react';
import Papa from 'papaparse';
import { FiUpload, FiCheckCircle, FiAlertCircle, FiEye } from 'react-icons/fi';
import { firestore } from '../../firebase/firebase.config';
import { doc, writeBatch, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import ShowmanualStock from '../../components/ToolsComponents/ShowmanualStock';

const BATCH_SIZE = 500;

// Helper: convert string values that look like numbers to numbers
function convertRowTypes(row) {
  const numPattern = /^-?\d+(\.\d+)?$/;
  const converted = {};
  for (const key in row) {
    const val = row[key];
    if (typeof val === 'string' && numPattern.test(val.trim())) {
      converted[key] = val.includes('.') ? parseFloat(val) : parseInt(val, 10);
    } else {
      converted[key] = val;
    }
  }
  return converted;
}

const ManualStocks = () => {
  const [csvData, setCsvData] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showStockModal, setShowStockModal] = useState(false);

  const handleFileUpload = (e) => {
    setError('');
    setSuccess('');
    setProgress(0);
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
      },
      error: (err) => setError('CSV parsing error: ' + err.message),
    });
  };

  const handleImport = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    setProgress(0);
    let imported = 0;
    let failed = 0;
    const total = csvData.length;
    
    console.log('Starting import with', total, 'rows');
    
    // Test Firebase connection first
    try {
      console.log('Testing Firebase connection...');
      const testDoc = doc(firestore, 'test_connection', 'test');
      await getDoc(testDoc);
      console.log('Firebase connection successful');
    } catch (e) {
      console.error('Firebase connection failed:', e);
      setError('Firebase connection failed: ' + e.message);
      setLoading(false);
      return;
    }
    
    for (let i = 0; i < total; i += BATCH_SIZE) {
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(total/BATCH_SIZE)}`);
      
      const batch = writeBatch(firestore);
      const chunk = csvData.slice(i, i + BATCH_SIZE);
      let batchImported = 0;
      
      for (const row of chunk) {
        const barcode = row.barcode || row.PID; // Use PID if barcode is missing
        if (!barcode) {
          failed++;
          console.log('Missing barcode/PID in row:', row);
          continue;
        }
        try {
          const convertedRow = convertRowTypes(row);
          batch.set(doc(firestore, 'manual_product', String(barcode)), convertedRow, { merge: false });
          batchImported++;
        } catch (e) {
          failed++;
          console.error(`Failed to prepare row for barcode ${barcode}:`, e);
        }
      }
      
      console.log(`Batch prepared: ${batchImported} rows ready to commit`);
      
      try {
        if (batchImported > 0) {
          console.log('Committing batch...');
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Batch commit timeout after 30 seconds')), 30000)
          );
          
          await Promise.race([
            batch.commit(),
            timeoutPromise
          ]);
          
          imported += batchImported;
          console.log(`Batch committed successfully: ${batchImported} rows imported`);
        }
      } catch (e) {
        failed += batchImported; // Count all rows in this batch as failed
        console.error('Batch commit failed:', e);
        setError('Batch commit failed: ' + e.message);
        // Don't return here, continue with next batch
      }
      
      setProgress(Math.min(100, Math.round(((i + chunk.length) / total) * 100)));
    }
    
    setLoading(false);
    setSuccess(`Imported: ${imported}, Failed: ${failed}`);
    setProgress(100);
    
    if (imported > 0) {
      toast.success(`Successfully imported ${imported} products to manual_product!`);
    } else {
      toast.error(`Import failed: ${failed} rows failed to import. Check console for details.`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FiUpload className="text-blue-500 text-3xl" />
          <h1 className="text-3xl font-bold tracking-tight">Manual Stock Import</h1>
        </div>
        <button
          onClick={() => setShowStockModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition font-semibold text-base"
        >
          <FiEye className="text-lg" /> Show Stock
        </button>
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-6 flex flex-col gap-4">
        <label className="font-semibold text-gray-700 mb-1">Choose File</label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      {csvData.length > 0 && (
        <div className="mb-4 bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-2 text-blue-700">Preview ({csvData.length} rows):</h2>
          <div className="overflow-x-auto max-h-64 border rounded">
            <table className="min-w-full text-xs">
              <thead className="bg-blue-50 sticky top-0">
                <tr>
                  {Object.keys(csvData[0] || {}).map((col) => (
                    <th key={col} className="p-1 text-blue-700 font-semibold">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b hover:bg-blue-50 transition">
                    {Object.keys(csvData[0] || {}).map((col) => (
                      <td key={col} className="p-1">{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition"
            onClick={handleImport}
            disabled={loading}
          >
            <FiUpload /> {loading ? 'Importing...' : 'Import to Firestore'}
          </button>
          {loading && (
            <div className="mt-4 w-full bg-gray-200 rounded h-3 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="text-red-600 flex items-center gap-2 mt-2"><FiAlertCircle /> {error}</div>
      )}
      {success && (
        <div className="text-green-600 flex items-center gap-2 mt-2"><FiCheckCircle /> {success}</div>
      )}
      <div className="mt-8 text-gray-500 text-xs bg-blue-50 rounded-xl p-4">
        <p>Each CSV row will be uploaded as a document in <b>manual_product</b> (doc ID = barcode).</p>
        <p>Numeric fields (including negative and decimal values) are stored as numbers for easier querying/calculation in Firestore. All other fields are stored as strings.</p>
        <p>Large files are uploaded in batches of 500 for Firestore efficiency.</p>
        <p>Make sure your Firebase config is set up in <code>src/firebase/firebase.config.js</code> and Firestore rules allow updates.</p>
      </div>
      <ShowmanualStock open={showStockModal} onClose={() => setShowStockModal(false)} />
    </div>
  );
};

export default ManualStocks;
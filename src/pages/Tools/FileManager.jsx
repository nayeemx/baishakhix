import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { firestore } from '../../firebase/firebase.config';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { FiFolderPlus, FiUpload, FiSearch, FiTrash2, FiFolder, FiChevronRight, FiChevronDown, FiImage } from 'react-icons/fi';

const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;
const MAX_IMAGES = 10;

// Helper: upload image to imgbb (multi-file)
async function uploadImagesToImgbb(files) {
  const urls = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      urls.push({
        url: data.data.url,
        imgbbId: data.data.id,
        deleteUrl: data.data.delete_url,
        name: file.name,
      });
    } else {
      throw new Error('Image upload failed');
    }
  }
  return urls;
}

function buildFolderTree(folders, parentId = null) {
  return folders
    .filter(f => f.parentId === parentId)
    .map(f => ({
      ...f,
      children: buildFolderTree(folders, f.id),
    }));
}

const FileManager = () => {
  const user = useSelector(state => state.auth.user);
  const [folders, setFolders] = useState([]); // all folders
  const [images, setImages] = useState([]); // images in current folder
  const [currentFolder, setCurrentFolder] = useState(null); // folder id (null = root)
  const [folderTree, setFolderTree] = useState([]); // for sidebar
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [subfolders, setSubfolders] = useState([]); // subfolders in current folder
  const [loadingFolders, setLoadingFolders] = useState(true);

  // Fetch all folders from 'file_manager' where type === 'folder'
  useEffect(() => {
    const fetchFolders = async () => {
      setLoadingFolders(true);
      try {
        const snap = await getDocs(query(collection(firestore, 'file_manager'), where('type', '==', 'folder')));
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFolders(data);
        // If no folders, set currentFolder to null
        if (data.length === 0) {
          setCurrentFolder(null);
        } else if (currentFolder !== null && !data.find(f => f.id === currentFolder)) {
          // If currentFolder was deleted, reset to root
          setCurrentFolder(null);
        }
      } catch (err) {
        console.error('[FileManager] Error fetching folders:', err);
      } finally {
        setLoadingFolders(false);
      }
    };
    fetchFolders();
    // eslint-disable-next-line
  }, []);

  // Build folder tree for sidebar
  useEffect(() => {
    setFolderTree(buildFolderTree(folders));
  }, [folders]);

  // Fetch images and subfolders for current folder from 'file_manager'
  useEffect(() => {
    if (currentFolder === null) {
      setImages([]);
      setSubfolders(folders.filter(f => f.parentId === null));
      return;
    }
    const fetchImagesAndSubfolders = async () => {
      // Images
      let q = query(collection(firestore, 'file_manager'), where('type', '==', 'image'), where('parentId', '==', currentFolder));
      const snap = await getDocs(q);
      setImages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Subfolders
      setSubfolders(folders.filter(f => f.parentId === currentFolder));
    };
    fetchImagesAndSubfolders();
  }, [currentFolder, folders]);

  // Create folder (as subfolder of current or as main if root)
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folderRef = await addDoc(collection(firestore, 'file_manager'), {
      type: 'folder',
      name: newFolderName.trim(),
      parentId: currentFolder === null ? null : currentFolder,
      createdAt: serverTimestamp(),
      createdByName: user?.name || '',
      createdByUid: user?.uid || '',
    });
    setNewFolderName('');
    setShowCreateFolder(false);
    // Refetch folders and set new folder as current
    const snap = await getDocs(query(collection(firestore, 'file_manager'), where('type', '==', 'folder')));
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setFolders(data);
    setCurrentFolder(folderRef.id);
  };

  // Upload images (multi-file)
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files).slice(0, MAX_IMAGES);
    if (!files.length || !currentFolder || !user) return;
    setUploading(true);
    try {
      const uploaded = await uploadImagesToImgbb(files);
      for (const img of uploaded) {
        await addDoc(collection(firestore, 'file_manager'), {
          type: 'image',
          name: img.name,
          url: img.url,
          imgbbId: img.imgbbId,
          deleteUrl: img.deleteUrl,
          parentId: currentFolder,
          folderName: (folders.find(f => f.id === currentFolder)?.name) || '',
          createdByName: user?.name || '',
          createdByUid: user?.uid || '',
          createdAt: serverTimestamp(),
        });
      }
      // Refresh images
      let q = query(collection(firestore, 'file_manager'), where('type', '==', 'image'), where('parentId', '==', currentFolder));
      const snap = await getDocs(q);
      setImages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  // Delete image
  const handleDeleteImage = async (imgId) => {
    if (!window.confirm('Delete this image?')) return;
    await deleteDoc(doc(firestore, 'file_manager', imgId));
    setImages(images.filter(img => img.id !== imgId));
  };

  // Folder navigation
  const renderFolderTree = (nodes, depth = 0) => (
    <ul className="pl-2">
      {nodes.map(node => (
        <li key={node.id}>
          <div className={`flex items-center gap-1 cursor-pointer ${currentFolder === node.id ? 'font-bold text-blue-600' : ''}`}
            style={{ paddingLeft: depth * 10 }}
            onClick={() => setCurrentFolder(node.id)}>
            {node.children.length > 0 && (
              <span onClick={e => { e.stopPropagation(); setExpandedFolders(f => ({ ...f, [node.id]: !f[node.id] })); }}>
                {expandedFolders[node.id] ? <FiChevronDown /> : <FiChevronRight />}
              </span>
            )}
            <FiFolder /> {node.name}
          </div>
          {node.children.length > 0 && expandedFolders[node.id] && renderFolderTree(node.children, depth + 1)}
        </li>
      ))}
    </ul>
  );

  // Search filter
  const filteredImages = search.trim()
    ? images.filter(img => img.name.toLowerCase().includes(search.trim().toLowerCase()))
    : images;

  return (
    <div className="flex h-[80vh] bg-white rounded shadow overflow-hidden">
      {/* Sidebar: Folders */}
      <div className="w-64 border-r p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-lg flex items-center gap-2"><FiFolder /> Folders</span>
          <button className="text-blue-600 flex items-center gap-1" onClick={() => setShowCreateFolder(v => !v)}><FiFolderPlus /> New</button>
        </div>
        {showCreateFolder && (
          <div className="mb-2 flex gap-1">
            <input className="border px-2 py-1 rounded w-full" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name" />
            <button className="bg-blue-600 text-white px-2 rounded" onClick={handleCreateFolder}>Create</button>
          </div>
        )}
        <div className="overflow-y-auto max-h-[60vh]">
          {/* Root node */}
          <div
            className={`flex items-center gap-1 cursor-pointer ${currentFolder === null ? 'font-bold text-blue-600' : ''}`}
            onClick={() => setCurrentFolder(null)}
          >
            <FiFolder /> Root
          </div>
          {loadingFolders ? (
            <div className="text-gray-400 text-center py-8">Loading folders...</div>
          ) : folders.length === 0 ? (
            <div className="text-gray-400 text-center py-8">No folders yet. Create one!</div>
          ) : (
            renderFolderTree(buildFolderTree(folders))
          )}
        </div>
      </div>
      {/* Main: Images and Subfolders */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b bg-gray-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <FiUpload />
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading || !currentFolder} />
            <span className="text-blue-600 hover:underline">Upload Images</span>
          </label>
          <input
            className="border rounded px-2 py-1 ml-4 w-64"
            placeholder="Search images..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Subfolders */}
        <div className="flex flex-wrap gap-4 p-4">
          {subfolders.map(sf => (
            <div key={sf.id} className="flex flex-col items-center cursor-pointer" onClick={() => setCurrentFolder(sf.id)}>
              <div className="bg-gray-200 rounded-full p-4 mb-1"><FiFolder className="text-2xl text-blue-600" /></div>
              <div className="text-xs text-gray-700 font-semibold">{sf.name}</div>
            </div>
          ))}
        </div>
        {/* Images */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredImages.length === 0 && <div className="col-span-full text-gray-400">No images found.</div>}
          {filteredImages.map(img => (
            <div key={img.id} className="border rounded shadow p-2 flex flex-col items-center bg-white relative group">
              <img src={img.url} alt={img.name} className="w-full max-h-40 object-contain mb-2 bg-gray-100 rounded" style={{height: '160px'}} />
              <div className="text-xs text-gray-700 truncate w-full text-center">{img.name}</div>
              <button
                className="absolute top-2 right-2 p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 opacity-0 group-hover:opacity-100"
                onClick={() => handleDeleteImage(img.id)}
                title="Delete"
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FileManager;
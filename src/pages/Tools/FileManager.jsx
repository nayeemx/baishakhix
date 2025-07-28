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
import { FiFolderPlus, FiUpload, FiSearch, FiTrash2, FiFolder, FiChevronRight, FiChevronDown, FiImage, FiX, FiZoomIn } from 'react-icons/fi';

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
  const [selectedImage, setSelectedImage] = useState(null); // for image preview modal
  const [showImageModal, setShowImageModal] = useState(false);
  const [brokenImages, setBrokenImages] = useState(new Set()); // track broken image URLs
  const [imageLoadStatus, setImageLoadStatus] = useState({}); // track loading status of each image

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
      const newImages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Loaded images from database:', newImages.map(img => ({ id: img.id, name: img.name, url: img.url })));
      setImages(newImages);
      
      // Initialize loading status for new images
      const newImageIds = newImages.map(img => img.id);
      setImageLoadStatus(prev => {
        const updated = { ...prev };
        newImageIds.forEach(id => {
          if (!updated[id]) {
            updated[id] = 'loading';
            // Set a timeout to mark images as broken if they don't load within 10 seconds
            setTimeout(() => {
              setImageLoadStatus(current => {
                if (current[id] === 'loading') {
                  console.log('Image load timeout:', id);
                  return { ...current, [id]: 'error' };
                }
                return current;
              });
            }, 10000);
          }
        });
        return updated;
      });
      
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

  // Delete folder
  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder and all its contents?')) return;
    
    try {
      // Delete all images in the folder
      const imagesQuery = query(collection(firestore, 'file_manager'), where('type', '==', 'image'), where('parentId', '==', folderId));
      const imagesSnap = await getDocs(imagesQuery);
      for (const imgDoc of imagesSnap.docs) {
        await deleteDoc(imgDoc.ref);
      }
      
      // Delete all subfolders in the folder
      const subfoldersQuery = query(collection(firestore, 'file_manager'), where('type', '==', 'folder'), where('parentId', '==', folderId));
      const subfoldersSnap = await getDocs(subfoldersQuery);
      for (const folderDoc of subfoldersSnap.docs) {
        await deleteDoc(folderDoc.ref);
      }
      
      // Delete the folder itself
      await deleteDoc(doc(firestore, 'file_manager', folderId));
      
      // Update local state
      setFolders(folders.filter(f => f.id !== folderId));
      if (currentFolder === folderId) {
        setCurrentFolder(null);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder');
    }
  };

  // Image preview modal
  const openImageModal = (image) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  // Handle broken images
  const handleImageError = (imageId) => {
    console.log('Image failed to load:', imageId);
    setBrokenImages(prev => new Set(prev).add(imageId));
    setImageLoadStatus(prev => ({ ...prev, [imageId]: 'error' }));
  };

  // Handle image load success
  const handleImageLoad = (imageId) => {
    console.log('Image loaded successfully:', imageId);
    setImageLoadStatus(prev => ({ ...prev, [imageId]: 'loaded' }));
  };

  // Check if image is broken
  const isImageBroken = (imageId) => {
    return brokenImages.has(imageId);
  };

  // Check if image is still loading
  const isImageLoading = (imageId) => {
    return imageLoadStatus[imageId] === 'loading';
  };

  // Clean up broken images from database
  const cleanupBrokenImages = async () => {
    if (brokenImages.size === 0) return;
    
    if (!window.confirm(`Delete ${brokenImages.size} broken image(s) from database?`)) return;
    
    try {
      for (const imageId of brokenImages) {
        await deleteDoc(doc(firestore, 'file_manager', imageId));
      }
      
      // Refresh images list
      if (currentFolder) {
        let q = query(collection(firestore, 'file_manager'), where('type', '==', 'image'), where('parentId', '==', currentFolder));
        const snap = await getDocs(q);
        setImages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
      
      setBrokenImages(new Set());
      alert('Broken images cleaned up successfully!');
    } catch (error) {
      console.error('Error cleaning up broken images:', error);
      alert('Failed to clean up broken images');
    }
  };

  // Remove debounced search - use immediate search instead

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setShowImageModal(false);
      }
    };
    
    if (showImageModal) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showImageModal]);

  // Folder navigation
  const renderFolderTree = (nodes, depth = 0) => (
    <ul className="pl-2">
      {nodes.map(node => (
        <li key={node.id}>
          <div className={`flex items-center gap-1 cursor-pointer group ${currentFolder === node.id ? 'font-bold text-blue-600' : ''}`}
            style={{ paddingLeft: depth * 10 }}
            onClick={() => setCurrentFolder(node.id)}>
            {node.children.length > 0 && (
              <span onClick={e => { e.stopPropagation(); setExpandedFolders(f => ({ ...f, [node.id]: !f[node.id] })); }}>
                {expandedFolders[node.id] ? <FiChevronDown /> : <FiChevronRight />}
              </span>
            )}
            <FiFolder /> {node.name}
            <button
              className="ml-auto opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(node.id);
              }}
              title="Delete folder"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
          {node.children.length > 0 && expandedFolders[node.id] && renderFolderTree(node.children, depth + 1)}
        </li>
      ))}
    </ul>
  );

  // Search filter - works for both images and folders
  const searchTerm = search.trim().toLowerCase();
  
  const filteredImages = searchTerm
    ? images.filter(img => img.name.toLowerCase().includes(searchTerm))
    : images;
  
  const filteredSubfolders = searchTerm
    ? subfolders.filter(sf => sf.name.toLowerCase().includes(searchTerm))
    : subfolders;

  // Filter folders in sidebar based on search
  const filteredFolderTree = searchTerm
    ? buildFolderTree(folders).filter(folder => 
        folder.name.toLowerCase().includes(searchTerm) ||
        folder.children.some(child => child.name.toLowerCase().includes(searchTerm))
      )
    : buildFolderTree(folders);

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
            renderFolderTree(filteredFolderTree)
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
          <div className="relative ml-4">
            <input
              className={`border rounded px-2 py-1 w-64 pr-8 ${searchTerm ? 'border-blue-500 bg-blue-50' : ''}`}
              placeholder="Search images and folders..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {searchTerm && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 text-xs">
                {filteredImages.length + filteredSubfolders.length} results
              </div>
            )}
          </div>
          {brokenImages.size > 0 && (
            <button
              className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
              onClick={cleanupBrokenImages}
              title={`Clean up ${brokenImages.size} broken image(s)`}
            >
              Clean Broken Images ({brokenImages.size})
            </button>
          )}
        </div>
        {/* Subfolders */}
        <div className="flex flex-wrap gap-4 p-4">
          {filteredSubfolders.map(sf => (
            <div key={sf.id} className="flex flex-col items-center cursor-pointer group" onClick={() => setCurrentFolder(sf.id)}>
              <div className="bg-gray-200 rounded-full p-4 mb-1 relative">
                <FiFolder className="text-2xl text-blue-600" />
                <button
                  className="absolute -top-1 -right-1 p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(sf.id);
                  }}
                  title="Delete folder"
                >
                  <FiTrash2 size={12} />
                </button>
              </div>
              <div className="text-xs text-gray-700 font-semibold">{sf.name}</div>
            </div>
          ))}
        </div>
        {/* Images */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredImages.length === 0 && filteredSubfolders.length === 0 && searchTerm && (
            <div className="col-span-full text-gray-400 text-center py-8">
              <div className="text-lg font-medium mb-2">No results found</div>
              <div className="text-sm">No images or folders match "{search}"</div>
              <div className="text-xs text-gray-500 mt-1">Try a different search term or check the folder tree on the left</div>
            </div>
          )}
          {filteredImages.length === 0 && filteredSubfolders.length === 0 && !searchTerm && (
            <div className="col-span-full text-gray-400 text-center py-8">
              <div className="text-lg font-medium mb-2">No images found</div>
              <div className="text-sm">Upload some images to get started</div>
            </div>
          )}
          {filteredImages.map(img => (
            <div key={img.id} className="border rounded shadow p-2 flex flex-col items-center bg-white relative group">
              <div className="relative w-full" style={{height: '100px'}}>
                {isImageBroken(img.id) ? (
                  <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <FiImage className="mx-auto text-2xl mb-1" />
                      <div className="text-xs">Image not found</div>
                    </div>
                  </div>
                ) : isImageLoading(img.id) ? (
                  <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <div className="text-xs">Loading...</div>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={img.url} 
                    alt={img.name} 
                    className="w-full h-full object-contain bg-gray-100 rounded cursor-pointer" 
                    onClick={() => openImageModal(img)}
                    onError={() => handleImageError(img.id)}
                    onLoad={() => handleImageLoad(img.id)}
                  />
                )}
                <button
                  className="absolute top-2 right-2 p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 opacity-0 group-hover:opacity-100"
                  onClick={() => handleDeleteImage(img.id)}
                  title="Delete"
                >
                  <FiTrash2 />
                </button>
                {!isImageBroken(img.id) && !isImageLoading(img.id) && (
                  <button
                    className="absolute top-2 left-2 p-1 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 opacity-0 group-hover:opacity-100"
                    onClick={() => openImageModal(img)}
                    title="View full size"
                  >
                    <FiZoomIn />
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-700 truncate w-full text-center mt-2">{img.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Preview Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="relative max-w-4xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 hover:bg-gray-100"
              onClick={() => setShowImageModal(false)}
            >
              <FiX size={24} />
            </button>
            {isImageBroken(selectedImage.id) ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <FiImage className="mx-auto text-6xl text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Image Not Found</h3>
                <p className="text-gray-500 mb-4">The image "{selectedImage.name}" could not be loaded.</p>
                <p className="text-sm text-gray-400">The image may have been deleted from the server or the URL is invalid.</p>
              </div>
            ) : (
              <img 
                src={selectedImage.url} 
                alt={selectedImage.name} 
                className="max-w-full max-h-full object-contain"
                onLoad={() => handleImageLoad(selectedImage.id)}
                onError={() => handleImageError(selectedImage.id)}
              />
            )}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              {selectedImage.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
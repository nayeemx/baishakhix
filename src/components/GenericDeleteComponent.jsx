import React, { useState } from 'react'
import {
  doc,
  deleteDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { useSelector } from 'react-redux'
import { firestore } from '../firebase/firebase.config'
import { toast } from 'react-toastify'

const GenericDeleteComponent = ({
  open,
  setOpen,
  id,
  queryClient,
  collectionName,
  currentUser,
}) => {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const user = useSelector(state => state.auth?.user)

  const handleDelete = async () => {
    setError('')
    if (!reason.trim()) {
      setError('Reason is required.')
      return
    }
    try {
      // 1. Get the document data before deleting
      const docRef = doc(firestore, collectionName, id)
      const docSnap = await getDoc(docRef)
      const deletedData = docSnap.exists() ? docSnap.data() : null

      // 2. Delete the document
      await deleteDoc(docRef)

      // 3. Log the delete trace in a single delete_traces collection
      await addDoc(collection(firestore, 'delete_traces'), {
        deleted_data: deletedData,
        deleted_id: id,
        table: collectionName,
        deleted_by:
          user?.displayName || user?.email || user?.uid || 'Unknown',
        deleted_by_uid: user?.uid || null,
        reason,
        deleted_at: serverTimestamp(),
      })

      // 4. Invalidate query and close modal
      if (queryClient && collectionName) {
        queryClient.invalidateQueries([collectionName])
      }
      setOpen(false)
      setReason('')
      toast.success('Deleted successfully!')
    } catch (err) {
      setError('Delete failed: ' + err.message)
      toast.error('Delete failed: ' + err.message)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white p-6 rounded shadow-lg min-w-[320px] flex flex-col gap-4">
        <h2 className="text-lg font-bold text-red-600">Confirm Delete</h2>
        <div>
          <label className="block mb-1 font-medium">
            Reason for delete{' '}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            className="border rounded p-2 w-full min-h-[60px]"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Please provide a reason for deletion"
            required
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button
            className="px-4 py-2 bg-gray-300 rounded"
            onClick={() => {
              setOpen(false)
              setReason('')
              setError('')
            }}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default GenericDeleteComponent

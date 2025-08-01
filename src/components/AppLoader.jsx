import React from 'react'
import Loader from './Loader'

const AppLoader = ({ bLogoSrc }) => (
  <div className="flex flex-col items-center justify-center min-h-[200px]">
    {bLogoSrc && (
      <img src={bLogoSrc} alt="Loading..." className="w-16 h-16 mb-4 animate-spin" />
    )}
    {/* <div className="text-lg text-gray-600">Loading...</div> */}
    <div>
      <Loader />
    </div>
  </div>
)

export default AppLoader
import Logo from '../assets/icons/b.png';

const Loader = () => (
  <div className="flex items-end justify-center min-h-[100px]">
    <img src={Logo} alt="Loading..." className="w-10 h-10 mr-2 animate-pulse" />
    <div className="flex space-x-1">
      <span className="animate-bounce text-red-500 text-3xl" style={{ animationDelay: '0ms' }}>.</span>
      <span className="animate-bounce text-red-500 text-3xl" style={{ animationDelay: '150ms' }}>.</span>
      <span className="animate-bounce text-red-500 text-3xl" style={{ animationDelay: '300ms' }}>.</span>
    </div>
  </div>
);

export default Loader;
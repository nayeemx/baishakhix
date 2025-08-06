import { useState } from "react";
import { useSelector } from "react-redux";
import Countdown from "react-countdown";
import { init, send } from "@emailjs/browser";
import {
  FaTshirt,
  FaInstagram,
  FaFacebook,
  FaTwitter,
  FaPinterest,
} from "react-icons/fa";

import construction1 from "../assets/construction/2756a623ac2360c14d9099e3f9beb53a.jpg";
import construction2 from "../assets/construction/8599d71be9f31859d7f2619bd022081c.jpg";
import construction3 from "../assets/construction/bf9239d4bd48833bc3a09db764895847.jpg";
import construction4 from "../assets/construction/749bf5ef940387a66c7ddef3685f6b1c.jpg";

// Initialize EmailJS
init(import.meta.env.VITE_EMAILJS_USER_ID);

const SocialIcon = ({ Icon, href }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="hover:text-indigo-800 transition-colors duration-200"
  >
    <Icon className="text-2xl" />
  </a>
);

const ProgressBar = ({ percentage }) => (
  <div className="w-full bg-gray-200 rounded-full h-4 mb-8 relative">
    <div
      className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
      style={{ width: `${percentage}%` }}
    >
      <span className="absolute -right-4 -top-8 text-indigo-800 font-medium">
        {percentage}%
      </span>
    </div>
  </div>
);

const CountdownCard = ({ value, label, bgColor }) => (
  <div
    className={`w-16 h-16 ${bgColor} text-white rounded-lg flex flex-col items-center justify-center`}
  >
    <span className="text-2xl font-bold">{value}</span>
    <span className="text-xs">{label}</span>
  </div>
);

const UnderConstruction = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [progress, setProgress] = useState(8);

  // Use Redux dark mode state
  const darkMode = useSelector((state) => state.theme.darkMode);

  // Countdown logic - target date + countdown days
  const targetDate = "8/25/2025";
  const targetTime = "12:00 AM";
  const countdownDays = 45;

  const targetDateTimeString = `${targetDate} ${targetTime}`;
  const targetDateTime = new Date(targetDateTimeString);
  const countdownDate = new Date(targetDateTime);
  countdownDate.setDate(countdownDate.getDate() + countdownDays);

  const launchDate = countdownDate;

  const CategoryCard = ({ title, description, imageUrl }) => (
    <div
      className={`rounded-lg overflow-hidden ${
        darkMode
          ? "shadow-sm shadow-gray-300"
          : "shadow-sm shadow-gray-300"
      }`}
    >
      <img src={imageUrl} alt={title} className="h-48 w-full object-cover" />
      <div className="p-4">
        <h4 className="text-lg font-semibold mb-2">{title}</h4>
        <p className="text-sm">{description}</p>
      </div>
    </div>
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;

    send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      {
        name: name || "Subscriber",
        email,
      }
    )
      .then(() => {
        setIsSubscribed(true);
        setName("");
        setEmail("");
        setTimeout(() => setIsSubscribed(false), 4000);
      })
      .catch((err) => {
        alert("Failed to send email. Try again later.");
        console.error(err);
      });
  };

  const socialLinks = [
    { Icon: FaInstagram, href: "#" },
    { Icon: FaFacebook, href: "#" },
    { Icon: FaTwitter, href: "#" },
    { Icon: FaPinterest, href: "#" },
  ];

  const productCategories = [
    {
      title: "Premium Clothing",
      description:
        "Suits, shirts, trousers, and casual wear crafted with the finest materials.",
      imageUrl: construction2,
    },
    {
      title: "Quality Footwear",
      description:
        "Handcrafted shoes with extended warranty. From formal to casual styles.",
      imageUrl: construction3,
    },
    {
      title: "Stylish Accessories",
      description:
        "Wallets, ties, belts, and undergarments to complete your look.",
      imageUrl: construction4,
    },
  ];

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-500 ${
        darkMode ? "bg-gray-900 text-white" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col min-h-screen">
        {/* Header */}
        <header className="py-8 flex justify-between items-center text-center">
          <div className="flex items-center space-x-2">
            <FaTshirt
              className={`text-3xl ${
                darkMode ? "text-indigo-400" : "text-indigo-800"
              }`}
            />
            <h1 className="text-3xl font-bold">Baishakhi Fashion</h1>
          </div>
        </header>

        {/* Main */}
        <main className="flex-grow flex flex-col md:flex-row items-center justify-between py-12 md:py-16 space-y-12 md:space-y-0 gap-6">
          {/* Left */}
          <div className="md:w-1/2 text-center md:text-left">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              We're Crafting Something Stylish
            </h2>
            <p className="text-xl mb-8">
              Our website is under construction. We're working hard to bring
              you the finest men's fashion collection.
            </p>

            <ProgressBar percentage={progress} />

            {/* Countdown */}
            <div className="mb-10">
              <p
                className={`text-lg mb-3 ${
                  darkMode ? "text-indigo-300" : "text-gray-900"
                }`}
              >
                Launching in:
              </p>
              <Countdown
                date={launchDate}
                renderer={({ days, hours, minutes, seconds, completed }) =>
                  completed ? (
                    <span className="text-indigo-600 dark:text-indigo-400">
                      We're live!
                    </span>
                  ) : (
                    <div className="flex space-x-4">
                      <CountdownCard
                        value={days}
                        label="Days"
                        bgColor={darkMode ? "bg-indigo-700" : "bg-indigo-800"}
                      />
                      <CountdownCard
                        value={hours}
                        label="Hours"
                        bgColor={darkMode ? "bg-indigo-600" : "bg-indigo-700"}
                      />
                      <CountdownCard
                        value={minutes}
                        label="Minutes"
                        bgColor={darkMode ? "bg-indigo-500" : "bg-indigo-600"}
                      />
                      <CountdownCard
                        value={seconds}
                        label="Seconds"
                        bgColor={darkMode ? "bg-indigo-400" : "bg-indigo-500"}
                      />
                    </div>
                  )
                }
              />
            </div>

            {/* Email + Name */}
            <div className="max-w-md mx-auto md:mx-0">
              <p className="mb-3">Get notified when we launch:</p>
              <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={`px-4 py-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 ${
                    darkMode
                      ? "bg-slate-800 text-gray-50 font-medium border-gray-600"
                      : "bg-gray-50 text-slate-700 font-medium border-gray-600"
                  }`}
                  required
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className={`px-4 py-3 rounded-lg border focus:ring-indigo-500 focus:border-indigo-500 ${
                    darkMode
                      ? "bg-slate-800 text-gray-50 font-medium border-gray-600"
                      : "bg-gray-50 text-slate-700 font-medium border-gray-600"
                  }`}
                  required
                />
                <button
                  type="submit"
                  className="bg-indigo-800 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Notify Me
                </button>
              </form>
              {isSubscribed && (
                <p className="text-green-500 mt-2">
                  Thank you! We'll notify you when we launch.
                </p>
              )}
            </div>

            {/* Socials */}
            <div className="mt-8">
              <p
                className={`mb-3 ${
                  darkMode ? "font-medium" : "font-medium"
                }`}
              >
                Follow us:
              </p>
              <div className="flex justify-center md:justify-start space-x-6">
                {socialLinks.map((link, idx) => (
                  <SocialIcon key={idx} {...link} />
                ))}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="md:w-1/2 relative">
            <div className="relative h-96 md:h-[600px] w-full overflow-hidden rounded-xl shadow-2xl">
              <img
                src={construction1}
                alt="Men's Fashion Under Construction"
                className="w-full h-full object-cover object-top"
              />
              <div
                className={`absolute inset-0 flex text-white flex-col justify-end p-6 ${
                  darkMode
                    ? "bg-gradient-to-t from-indigo-900/70 to-transparent"
                    : "bg-gradient-to-t from-indigo-800/90 to-transparent"
                }`}
              >
                <h3 className="text-2xl font-bold mb-2">
                  Premium Men's Fashion
                </h3>
                <p>Clothing • Footwear • Accessories</p>
              </div>
            </div>
          </div>
        </main>

        {/* Categories */}
        <section className="py-12">
          <h3 className="text-2xl font-bold text-center mb-10">
            Coming Soon: Our Collections
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {productCategories.map((category, idx) => (
              <CategoryCard key={idx} {...category} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default UnderConstruction;
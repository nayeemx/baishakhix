import { useSelector } from "react-redux";
import {
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaCheckCircle,
  FaHourglassHalf,
  FaCalendarAlt,
} from "react-icons/fa";

const ContactItem = ({ Icon, text }) => (
  <li className="flex items-center gap-2">
    <Icon className="text-indigo-800" />
    <span>{text}</span>
  </li>
);

const TimelineItem = ({ Icon, text, iconColor }) => (
  <li className="flex items-center gap-2">
    <Icon className={iconColor} />
    <span>{text}</span>
  </li>
);

const Footer = () => {
  const darkMode = useSelector((state) => state.theme.darkMode);
  const currentYear = new Date().getFullYear();

  const contacts = [
    {
      Icon: FaMapMarkerAlt,
      text: "68/1 Purana Paltan, Dhaka 1000, Bangladesh",
    },
    {
      Icon: FaPhone,
      text: "+8801511-555539",
    },
    {
      Icon: FaEnvelope,
      text: "i.n15@outlook.com",
    },
  ];

  const timeline = [
    {
      Icon: FaCheckCircle,
      text: "Design Phase - Completed",
      iconColor: "text-green-600",
    },
    {
      Icon: FaCheckCircle,
      text: "Development - In Progress (8%)",
      iconColor: "text-green-600",
    },
    {
      Icon: FaHourglassHalf,
      text: "Testing - Coming Soon",
      iconColor: "text-yellow-600",
    },
    {
      Icon: FaCalendarAlt,
      text: "Expected Launch: July 24, 2025",
      iconColor: "text-indigo-800",
    },
  ];

  return (
    <footer
      className={`py-12 border-t text-sm print:hidden ${
        darkMode
          ? "bg-gray-900 text-gray-300 border-gray-700"
          : "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="text-lg font-semibold mb-4">About Us</h4>
            <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              We are a premium men's fashion retailer dedicated to providing
              high-quality clothing, footwear, and accessories for the modern
              gentleman.
            </p>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Contact Information</h4>
            <ul className={`space-y-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              {contacts.map((contact, idx) => (
                <ContactItem key={idx} {...contact} />
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4">Launch Timeline</h4>
            <ul className={`space-y-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              {timeline.map((item, idx) => (
                <TimelineItem key={idx} {...item} />
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 text-center border-t-2 border-gray-200 dark:border-gray-700">
          <p className={`mt-4 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
            © {currentYear} Innologbd. All rights reserved.
          </p>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            <a
              href="https://innologybd.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-indigo-600 hover:text-indigo-600"
            >
              innologybd.com
            </a>{" "}
            | <span className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>Call: +880 1674297991</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
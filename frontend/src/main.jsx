import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global Timezone Patch: treat naive ISO datetime strings from database as UTC
// so that JS parses them in UTC and correctly displays them in the user's local device timezone.
(function () {
  const OriginalDate = window.Date;
  function SafeDate(...args) {
    if (this instanceof SafeDate || this instanceof OriginalDate) {
      if (args.length === 1 && typeof args[0] === 'string') {
        let dateStr = args[0];
        // Check if it matches ISO format with 'T' and lacks timezone offset
        if (dateStr.includes('T') && !dateStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(dateStr)) {
          dateStr = dateStr + 'Z';
        }
        return new OriginalDate(dateStr);
      }
      return new OriginalDate(...args);
    }
    return OriginalDate(...args);
  }
  
  // Copy static methods and prototype properties
  Object.getOwnPropertyNames(OriginalDate).forEach(name => {
    if (!(name in SafeDate)) {
      Object.defineProperty(SafeDate, name, Object.getOwnPropertyDescriptor(OriginalDate, name));
    }
  });
  SafeDate.prototype = OriginalDate.prototype;
  SafeDate.prototype.constructor = SafeDate;
  
  window.Date = SafeDate;
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
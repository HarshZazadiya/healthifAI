import { useState } from 'react';
import MapComponent from './MapComponent';

const LocationPicker = ({ onLocationSelect, initialLat, initialLon }) => {
  const [lat, setLat] = useState(initialLat || '');
  const [lon, setLon] = useState(initialLon || '');
  const [method, setMethod] = useState('manual');

  const getLocationByGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLon(pos.coords.longitude);
          onLocationSelect(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => alert('GPS error: ' + err.message)
      );
    } else {
      alert('GPS not supported');
    }
  };

  const getLocationByIP = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      setLat(data.latitude);
      setLon(data.longitude);
      onLocationSelect(data.latitude, data.longitude);
    } catch (err) {
      alert('IP location failed');
    }
  };

  const handleManualSubmit = () => {
    if (lat && lon) {
      onLocationSelect(parseFloat(lat), parseFloat(lon));
    } else {
      alert('Enter valid lat/lon');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button onClick={() => setMethod('gps')} className={`px-3 py-1 rounded ${method === 'gps' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>GPS</button>
        <button onClick={() => setMethod('ip')} className={`px-3 py-1 rounded ${method === 'ip' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>IP Address</button>
        <button onClick={() => setMethod('manual')} className={`px-3 py-1 rounded ${method === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Manual</button>
      </div>

      {method === 'gps' && (
        <button onClick={getLocationByGPS} className="bg-green-600 text-white px-4 py-2 rounded">Use GPS</button>
      )}
      {method === 'ip' && (
        <button onClick={getLocationByIP} className="bg-green-600 text-white px-4 py-2 rounded">Use IP Location</button>
      )}
      {method === 'manual' && (
        <div className="space-y-2">
          <input type="number" step="any" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} className="border p-2 w-full" />
          <input type="number" step="any" placeholder="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} className="border p-2 w-full" />
          <button onClick={handleManualSubmit} className="bg-blue-600 text-white px-4 py-2 rounded">Set Location</button>
        </div>
      )}

      {lat && lon && (
        <div className="mt-4">
          <MapComponent markers={[{ lat: parseFloat(lat), lon: parseFloat(lon), label: 'Selected Location' }]} center={[parseFloat(lat), parseFloat(lon)]} zoom={13} />
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
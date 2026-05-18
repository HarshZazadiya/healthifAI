import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MapComponent = ({ markers, center = [20.5937, 78.9629], zoom = 5 }) => {
  // Filter out markers with invalid coordinates
  const validMarkers = (markers || []).filter(m => 
    m && typeof m.lat === 'number' && typeof m.lon === 'number' && !isNaN(m.lat) && !isNaN(m.lon)
  );
  
  if (validMarkers.length === 0) {
    return <div className="bg-gray-100 p-4 text-center rounded">No location data to display on map.</div>;
  }

  // Use first marker as center if available
  const mapCenter = [validMarkers[0].lat, validMarkers[0].lon];

  const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <MapContainer center={mapCenter} zoom={zoom} style={{ height: '100%', width: '100%', minHeight: '400px' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validMarkers.map((marker, idx) => (
        <Marker key={idx} position={[marker.lat, marker.lon]} icon={marker.isUser ? userIcon : new L.Icon.Default()}>
          <Popup>{marker.label || 'Location'}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapComponent;
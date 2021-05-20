const map = L.map('map').setView([39.25358544545336, -76.71351916068153], 12);

const Stamen_Terrain = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}', {
  attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  subdomains: 'abcd',
  minZoom: 0,
  maxZoom: 18,
  ext: 'png'
});

const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
});

var Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

var wmsLayer = L.tileLayer.wms('http://fccle.greenbank.lan:8080/geoserver/dd_micro_LO/wms?', {
    layers: "dd_micro_LO"
})

CartoDB_Positron.addTo(map);

let basemaps = {
  "Positron": CartoDB_Positron,
  "Terrain": Stamen_Terrain,
  "Satellite": Esri_WorldImagery,
  "Microwave Tower Dots": wmsLayer
};
L.control.layers(basemaps).addTo(map);


function log(str) {
  const textarea = document.getElementById("log");
  textarea.innerHTML += "\n" + str;
  textarea.scrollTop = textarea.scrollHeight;
}

let paths = [];
let paths_layer = L.polyline(paths, { color: 'red', weight: 2 }).addTo(map);

function pathTrace(callsign, loc_number, iterations, my_long, my_lat, prev_ids) {
  fetch(`/api/microwave_paths?callsign=${callsign}&loc_number=${loc_number}&iterations=${iterations}`)
    .then(response => response.json())
    .then(data => {
      console.log(data);
      document.getElementById("dash").innerHTML += "\n" + JSON.stringify(data);
      document.getElementById("dash").scrollTop = document.getElementById("dash").scrollHeight;
      const existing_ids = microwave_towers.toGeoJSON().features.map((x) => x.id);
      for (feature of data) {
        if (!existing_ids.includes(feature.id)) {
          log(`New tower discovered! Callsign ${feature.properties.call_sign}.`)
          microwave_towers.addData(feature);
        }
        const fc = feature.geometry.coordinates;
        paths.push([[my_lat, my_long], [fc[1], fc[0]]]);
        paths_layer.remove();
        paths_layer = L.polyline(paths, { color: 'red' }).addTo(map);
        const callsign = feature.properties.call_sign;
        const loc_number = feature.properties.location_number;
        const my_id = feature.id;
        if (!prev_ids.includes(my_id)) {
          let new_arr = prev_ids.slice();
          new_arr.push(my_id)
          pathTrace(callsign, loc_number, 1, fc[0], fc[1], new_arr);
        }
      }
      microwave_markers.addLayer(microwave_towers);
      map.addLayer(microwave_markers);
    });
}

function onEachMicrowaveTower(feature, layer) {
  const callsign = feature.properties.call_sign;
  const loc_number = feature.properties.location_number;
  const my_id = feature.id;
  layer.bindPopup("Call sign: <b>" + feature.properties.call_sign + "</b><br>"
    + "Ground elevation: <b>" + feature.properties.ground_elevation + "</b><br>"
    + `Path trace: <button onclick="pathTrace('${callsign}', ${loc_number}, 1, ${feature.geometry.coordinates}, [${my_id}])">1</button>`);
  /*layer.on("click", (e) => {
  });*/
}

const microwave_markers = L.markerClusterGroup();
let awaiting_mass_click = false;
function analyzeCluster() {
  if (awaiting_mass_click) {
    awaiting_mass_click = false;
    log("Cluster analysis deactivated.");
  } else {
    awaiting_mass_click = true;
    log("Cluster analysis on, awaiting click on cluster...");
  }
}
microwave_markers.on("clusterclick", (e) => {
  if (!awaiting_mass_click) return;
  console.log(e);
  log("Click received.");
  e.originalEvent.preventDefault();
  awaiting_mass_click = false;
  markers = e.layer.getAllChildMarkers();
  if (markers.length > 100) {
    const confout = confirm(`Warning: This cluster contains ${markers.length} microwave towers.`
      + ` Are you sure you want to path-trace them all? There will be a large performance hit and this may take a while.`);
    if (!confout) return;
  }
  for (marker of markers) {
    const feature = marker.feature;
    const callsign = feature.properties.call_sign;
    const loc_number = feature.properties.location_number;
    console.log(feature.geometry.coordinates);
    const my_id = feature.id;
    pathTrace(callsign, loc_number, 1, feature.geometry.coordinates[0], feature.geometry.coordinates[1], [my_id]);
  }
})

let microwave_towers = L.geoJSON(null, {
  onEachFeature: onEachMicrowaveTower
});
microwave_markers.addLayer(microwave_towers);
map.addLayer(microwave_markers);

function loadMicrowave() {
  const center = map.getCenter();
  fetch("/api/microwave_towers?lat=" + center.lat + "&lon=" + center.lng)
    .then(response => response.json())
    .then(data => {
      data = data[0];
      const existing_ids = microwave_towers.toGeoJSON().features.map((x) => x.id);
      let addedCount = 0;
      for (feature of data.features) {
        if (!existing_ids.includes(feature.id)) {
          microwave_towers.addData(feature);
          addedCount++;
        }
      }
      microwave_markers.clearLayers();
      microwave_markers.addLayer(microwave_towers);
      map.addLayer(microwave_markers);
      log(`Database returned ${data.features.length} towers. ${addedCount} were new.`);
    });
}

function clearTowers() {
  microwave_towers.clearLayers();
  microwave_markers.clearLayers();
}

function clearPaths() {
  paths = [];
  paths_layer.remove();
}
const map = L.map('map').setView([39.25358544545336, -76.71351916068153], 13);

// ====== BASEMAPS ======

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

var OpenStreetMap_Mapnik = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

var wmsLayer = L.tileLayer.wms('http://fccle.greenbank.lan/gs/geoserver/dd_micro_LO/wms?', {
  layers: "dd_micro_LO",
  transparency: "true",
  opacity: 0.35
})

CartoDB_Positron.addTo(map);

var dotsLayerCombined = L.layerGroup([wmsLayer, CartoDB_Positron]);

let basemaps = {
  "Positron": CartoDB_Positron,
  "Terrain": Stamen_Terrain,
  "Satellite": Esri_WorldImagery,
  "OpenStreetMap": OpenStreetMap_Mapnik,
  "Microwave Tower Dots": dotsLayerCombined
};
L.control.layers(basemaps).addTo(map);

// ====== UTILITY FUNCTIONS ======

function log(str) {
  const textarea = document.getElementById("log");
  textarea.innerHTML += "\n" + str;
  textarea.scrollTop = textarea.scrollHeight;
}

function downloadGeoJSON(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:application/geo+json;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// ====== MICROWAVE TOWERS AND PATHS ======

let paths = [];
const paths_style = { color: 'red', weight: 2, opacity: 0.8 };
let paths_layer = L.polyline(paths, paths_style).addTo(map);
document.getElementById("inflight").value = 0;

function pathTrace(callsign, loc_number, propagate, my_long, my_lat, prev_ids) {
  document.getElementById("inflight").value++;
  fetch(`/api/microwave_paths?callsign=${callsign}&loc_number=${loc_number}&iterations=${propagate}`)
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
        paths_layer = L.polyline(paths, paths_style, { color: 'red' }).addTo(map);
        const callsign = feature.properties.call_sign;
        const loc_number = feature.properties.location_number;
        const my_id = feature.id;
        if (!prev_ids.includes(my_id)) {
          prev_ids.push(my_id)
          pathTrace(callsign, loc_number, 1, fc[0], fc[1], prev_ids);
        }
      }
      microwave_markers.addLayer(microwave_towers);
      map.addLayer(microwave_markers);
    })
    .finally(() => {
      document.getElementById("inflight").value--;
    });
}

function onEachMicrowaveTower(feature, layer) {
  const callsign = feature.properties.call_sign;
  const loc_number = feature.properties.location_number;
  const my_id = feature.id;
  layer.bindPopup("Call sign: <b>" + feature.properties.call_sign + "</b><br>"
    + "Ground elevation: <b>" + feature.properties.ground_elevation + "</b><br>"
    + `<button onclick="pathTrace('${callsign}', ${loc_number}, 1, ${feature.geometry.coordinates}, [${my_id}])">Path Trace</button>`);
  /*layer.on("click", (e) => {
  });*/
}

const microwave_markers = L.markerClusterGroup();
let awaiting_mass_click = false;
function analyzeCluster() {
  if (awaiting_mass_click) {
    awaiting_mass_click = false;
    document.getElementById("analyzeClusterButton").classList.remove("activated_button");
    document.getElementById("analyzeClusterButtonText").innerText = "Path Trace all in Cluster";
    log("Cluster analysis deactivated.");
  } else {
    awaiting_mass_click = true;
    document.getElementById("analyzeClusterButton").classList.add("activated_button");
    document.getElementById("analyzeClusterButtonText").innerText = "Click on a cluster, or click here to stop.";
    log("Cluster analysis on, awaiting click on cluster...");
  }
}
microwave_markers.on("clusterclick", (e) => {
  if (!awaiting_mass_click) return;
  console.log(e);
  log("Click received.");
  // attempt event cancel
  /*L.DomEvent.preventDefault(e);
  L.DomEvent.preventDefault(e.originalEvent);
  e.returnValue = false;
  console.log(e);*/
  // get markers in cluster
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
  const bounds = map.getBounds();
  const swlat = bounds._southWest.lat;
  const swlon = bounds._southWest.lng;
  const nelat = bounds._northEast.lat;
  const nelon = bounds._northEast.lng;
  if (map.getBoundsZoom(bounds) < 11.5) {
    const confout = confirm(`Warning: You are zoomed out a lot.`
      + ` This query may take a very long time to run and/or slow down your browser. Are you sure you want to continue?`);
    if (!confout) return;
  }
  log("Querying...");
  fetch("/api/microwave_towers?swlat=" + swlat + "&swlon=" + swlon
    + "&nelat=" + nelat + "&nelon=" + nelon)
    .then(response => response.json())
    .then(data => {
      data = data[0];
      const existing_ids = microwave_towers.toGeoJSON().features.map((x) => x.id);
      let addedCount = 0;
      if (data.features.length == 4000) {
        alert("You were limited by the server. Only 4000 towers have been returned. Please zoom in and query a smaller patch of land.");
      }
      for (feature of data.features) {
        if (!existing_ids.includes(feature.id)) {
          microwave_towers.addData(feature);
          addedCount++;
        }
      }
      microwave_markers.clearLayers();
      microwave_markers.addLayer(microwave_towers);
      map.addLayer(microwave_markers);
      log(`Database returned ${data.features.length} towers`
        + (data.features.length == 4000 ? " [MAXXED OUT]" : "")
        + `. ${addedCount} were new.`);
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

// ====== PAGING TOWERS ======

var pagerMarkerStyle = {
  radius: 4,
  fillColor: "#ff7800",
  color: "#000",
  weight: 1,
  opacity: 0.9,
  fillOpacity: 0.7
};

let paging_towers = L.geoJSON(null, {
  onEachFeature: (feature, layer) => {
    const freq = feature.properties.paging_EM_frequency_assigned;
    layer.bindPopup("Call sign: <b>" + feature.properties.call_sign + "</b><br>"
      + "Assigned frequency: <b><a href=\"cubicsdr://" + freq + "\">" + freq + " MHz</a></b><br>");
  },
  pointToLayer: function (feature, latlng) {
    return L.circleMarker(latlng, pagerMarkerStyle);
  }
}).addTo(map);
function loadPaging() {
  const bounds = map.getBounds();
  const swlat = bounds._southWest.lat;
  const swlon = bounds._southWest.lng;
  const nelat = bounds._northEast.lat;
  const nelon = bounds._northEast.lng;
  if (map.getBoundsZoom(bounds) < 11.5) {
    const confout = confirm(`Warning: You are zoomed out a lot.`
      + ` This query may take a very long time to run and/or slow down your browser. Are you sure you want to continue?`);
    if (!confout) return;
  }
  log("Querying...");
  fetch("/api/paging_towers?swlat=" + swlat + "&swlon=" + swlon
    + "&nelat=" + nelat + "&nelon=" + nelon)
    .then(response => response.json())
    .then(data => {
      data = data[0];
      const existing_ids = paging_towers.toGeoJSON().features.map((x) => x.id);
      let addedCount = 0;
      for (feature of data.features) {
        if (!existing_ids.includes(feature.id)) {
          paging_towers.addData(feature);
          addedCount++;
        }
      }
      //paging_towers.clearLayers();
      map.addLayer(paging_towers);
      log(`Database returned ${data.features.length} PAGING towers. ${addedCount} were new.`);
    });
}

// ====== DOWNLOAD/EXPORT ======

function downloadTowers() {
  downloadGeoJSON("microwave_towers.geojson", JSON.stringify(microwave_towers.toGeoJSON()));
}

function downloadPaths() {
  downloadGeoJSON("microwave_paths.geojson", JSON.stringify(paths_layer.toGeoJSON()));
}
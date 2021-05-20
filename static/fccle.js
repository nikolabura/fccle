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

CartoDB_Positron.addTo(map);

/*var wmsLayer = L.tileLayer.wms('http://fccle.greenbank.lan:8080/geoserver/dd_micro_LO/wms?', {
    layers: "dd_micro_LO"
}).addTo(map);*/

function onEachMicrowaveTower(feature, layer) {
  layer.bindPopup("Call sign: <b>" + feature.properties.call_sign + "</b>");
  /*layer.on("click", (e) => {

  });*/
}

const microwave_towers = L.geoJSON(null, {
  onEachFeature: onEachMicrowaveTower
}).addTo(map);

function loadMicrowave() {
  const center = map.getCenter();
  fetch("/api/microwave_towers?lat=" + center.lat + "&lon=" + center.lng)
    .then(response => response.json())
    .then(data => {
      data = data[0];
      const existing_ids = microwave_towers.toGeoJSON().features.map((x) => x.id);
      for (feature of data.features) {
        if (!existing_ids.includes(feature.id)) {
          microwave_towers.addData(feature);
        }
      }
    });
}
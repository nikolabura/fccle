from flask import Flask
from flask import send_file, jsonify, request

import psycopg2

app = Flask(__name__, static_url_path="/static")

conn = psycopg2.connect("dbname=fccle user=fccle_viewer password=fickle_password host=localhost")

@app.route("/")
def root():
    return send_file("static/index.html")

@app.route("/api/microwave_towers")
def microwave_towers():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    sql = """
    SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', jsonb_agg(features.feature)
    )
    FROM (
        SELECT jsonb_build_object(
            'type',       'Feature',
            'id',         id,
            'geometry',   ST_AsGeoJSON(geom)::jsonb,
            'properties', to_jsonb(inputs) - 'gid' - 'geom'
        ) AS feature
        FROM (
            SELECT *
            FROM fccle."dd_micro_LO"
            WHERE ST_DWithin(geom,
                             ST_SetSRID(ST_MakePoint(%s,%s), 4326),
                             0.09)
            LIMIT 700
        ) inputs
    ) features;
    """
    cur = conn.cursor()
    cur.execute(sql, (lon, lat))
    towers = cur.fetchone()
    cur.close()
    return jsonify(towers)


@app.route("/api/paging_towers")
def paging_towers():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    sql = """
    SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', jsonb_agg(features.feature)
    )
    FROM (
        SELECT jsonb_build_object(
            'type',       'Feature',
            'id',         id,
            'geometry',   ST_AsGeoJSON(geom)::jsonb,
            'properties', to_jsonb(inputs) - 'gid' - 'geom'
        ) AS feature
        FROM (
            SELECT *
            FROM fccle."dd_paging_LO"
            WHERE ST_DWithin(geom,
                             ST_SetSRID(ST_MakePoint(%s,%s), 4326),
                             0.2)
            LIMIT 700
        ) inputs
    ) features;
    """
    cur = conn.cursor()
    cur.execute(sql, (lon, lat))
    towers = cur.fetchone()
    cur.close()
    return jsonify(towers)


@app.route("/api/microwave_paths")
def microwave_paths():
    iterations = request.args.get("iterations")
    callsign = request.args.get("callsign")
    location_number = request.args.get("loc_number")
    cur = conn.cursor()
    sql = """
    SELECT * FROM fccle.microwave_paths m
    WHERE
        (m.callsign = %s AND m.transmit_location_number = %s)
        OR (m.receiver_callsign = %s AND m.receiver_location_number = %s)
    LIMIT 50;
    """
    cur.execute(sql, (callsign, location_number, callsign, location_number))
    paths = cur.fetchall()
    partners = []
    me = (callsign, int(location_number))
    for path in paths:
        #print(path)
        if path[4] == None or path[16] == None:
            print("Had none")
            continue
        tx_callsign = path[4].strip()
        tx_locnum = path[7]
        rx_callsign = path[16].strip()
        rx_locnum = path[9]
        tx = (tx_callsign, tx_locnum)
        rx = (rx_callsign, rx_locnum)
        if tx != me:
            partners.append(tx)
        if rx != me:
            partners.append(rx)
    partners = set(partners)
    print(partners)
    if len(partners) == 0:
        return "[]"
    partners_json_out = []
    for partner in partners:
        sql = """
        SELECT jsonb_build_object(
            'type',       'Feature',
            'id',         id,
            'geometry',   ST_AsGeoJSON(geom)::jsonb,
            'properties', to_jsonb(inputs) - 'gid' - 'geom'
        ) AS feature
        FROM (
            SELECT *
            FROM fccle."dd_micro_LO"
            WHERE call_sign = %s AND location_number = %s
            LIMIT 500
        ) inputs;
        """
        cur.execute(sql, (partner[0], partner[1]))
        partner_geojson = cur.fetchone()[0]
        partners_json_out.append(partner_geojson)
    cur.close()
    return jsonify(partners_json_out)

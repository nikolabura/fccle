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
    sql = f"""
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
                             0.06)
            LIMIT 500
        ) inputs
    ) features;
    """
    cur = conn.cursor()
    cur.execute(sql, (lon, lat))
    towers = cur.fetchone()
    cur.close()
    return jsonify(towers)


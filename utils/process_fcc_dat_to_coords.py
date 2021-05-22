# Nikola Bura GES486

import csv
csv.register_dialect('piper', delimiter='|', quoting=csv.QUOTE_NONE)

def dms2dd(degrees, minutes, seconds, direction):
    dd = float(degrees) + float(minutes)/60 + float(seconds)/(60*60)
    if direction == 'W' or direction == 'S':
        dd *= -1
    return dd

totalcount = 0
with open("data/paging_LO.dat", "r") as csvfile:
    dictreader = csv.DictReader(csvfile, dialect='piper')
    with open("data/dd_paging_LO.dat", "w", newline="") as outfile:
        fn = list(dictreader.fieldnames)
        fn.append("lat_dd")
        fn.append("long_dd")
        writer = csv.DictWriter(outfile, fieldnames=fn, dialect="piper")
        writer.writeheader()
        for row in dictreader:
            totalcount += 1
            try:
                lat = dms2dd(row["lat_degrees"], row["lat_minutes"], row["lat_seconds"], row["lat_direction"])
                long = dms2dd(row["long_degrees"], row["long_minutes"], row["long_seconds"], row["long_direction"])
                row["lat_dd"] = lat
                row["long_dd"] = long
                writer.writerow(row)
            except Exception as e:
                pass
                #print(e)
            if totalcount % 20000 == 0:
                print("#", end="", flush=True)

print(" ", totalcount)

import geopandas as gpd
import osmnx as ox
from shapely.geometry import shape
import numpy as np 

def get_candidate_sites(aoi_geojson, tags: list):
    
    # Fetch candidate site locations inside the AOI
    aoi_polygon = shape(aoi_geojson)
    gdf = ox.features_from_polygon(aoi_polygon, tags)  
    gdf = gdf[gdf.geometry.type == "Point"].copy()
    gdf = gdf.reset_index(drop=True)
    return gdf[["geometry", "name"]]

# def get_candidate_sites(aoi_geojson, tags: list):
#     import requests
#     import json
#     import geopandas as gpd
#     from shapely.geometry import Point
    
#     # Fetch candidate site locations inside the AOI
#     aoi_polygon = shape(aoi_geojson)
    
#     # Get bounding box for Overpass API query
#     minx, miny, maxx, maxy = aoi_polygon.bounds
    
#     # Direct Overpass API query (bypasses OSMnx CRS issues)
#     overpass_url = "http://overpass-api.de/api/interpreter"
#     overpass_query = f"""
#     [out:json][timeout:25];
#     (
#       way["building"]({miny},{minx},{maxy},{maxx});
#       relation["building"]({miny},{minx},{maxy},{maxx});
#     );
#     out geom;
#     """
    
#     try:
#         response = requests.get(overpass_url, params={'data': overpass_query})
#         response.raise_for_status()
#         osm_data = response.json()
        
#         # Process OSM data
#         points = []
#         names = []
        
#         for element in osm_data.get('elements', []):
#             if element.get('type') == 'way' and 'nodes' in element:
#                 # Get centroid of way
#                 coords = []
#                 for node in element.get('geometry', []):
#                     coords.append([node['lon'], node['lat']])
                
#                 if coords:
#                     # Calculate centroid
#                     avg_lon = sum(c[0] for c in coords) / len(coords)
#                     avg_lat = sum(c[1] for c in coords) / len(coords)
#                     point = Point(avg_lon, avg_lat)
                    
#                     # Check if point is within polygon
#                     if aoi_polygon.contains(point):
#                         points.append(point)
#                         name = element.get('tags', {}).get('name', 'Unnamed Building')
#                         names.append(name)
        
#         # Create GeoDataFrame
#         if points:
#             gdf = gpd.GeoDataFrame({'name': names, 'geometry': points})
#         else:
#             gdf = gpd.GeoDataFrame(columns=['name', 'geometry'])
            
#         print(f"Found {len(gdf)} candidate sites")
#         return gdf[["geometry", "name"]]
        
#     except Exception as e:
#         print(f"Error querying Overpass API: {e}")
#         # Return empty GeoDataFrame
#         return gpd.GeoDataFrame(columns=["geometry", "name"])

# Added helper to simulate or apply age group population weights
def add_age_data_to_points(gdf: gpd.GeoDataFrame):
    age_brackets = ['<15', '15‑35', '35‑60', '60+']
    for bracket in age_brackets:
        gdf[bracket] = np.random.randint(0, 100, size=len(gdf))  
    return gdf

 # Generate demand points inside AOI and weight by age groups if provided
def get_demand_points(aoi_geojson, selected_age_groups: list):
    aoi_polygon = shape(aoi_geojson)
    gdf = ox.features_from_polygon(aoi_polygon, {"building": True})
    gdf = gdf[gdf.geometry.type == "Polygon"].copy()
    gdf["geometry"] = gdf.centroid
    gdf = gdf.reset_index(drop=True)

    gdf = add_age_data_to_points(gdf)
    if selected_age_groups:
        # sum population in selected brackets
        gdf["weight"] = gdf[selected_age_groups].sum(axis=1)
    else:
        gdf["weight"] = 1.0
    return gdf[["geometry", "weight"]]

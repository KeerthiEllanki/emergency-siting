import geopandas as gpd
import osmnx as ox
from shapely.geometry import shape
import numpy as np 

def get_candidate_sites(aoi_geojson, tags: list):
    """Fetch candidate site locations inside the AOI."""
    aoi_polygon = shape(aoi_geojson)
    gdf = ox.features_from_polygon(aoi_polygon, tags)  # your original retrieval logic
    gdf = gdf[gdf.geometry.type == "Point"].copy()
    gdf = gdf.reset_index(drop=True)
    return gdf[["geometry", "name"]]

# Added helper to simulate or apply age group population weights
def add_age_data_to_points(gdf: gpd.GeoDataFrame):
    age_brackets = ['<15', '15‑35', '35‑60', '60+']
    for bracket in age_brackets:
        gdf[bracket] = np.random.randint(0, 100, size=len(gdf))  # placeholder synthetic counts
    return gdf

def get_demand_points(aoi_geojson, selected_age_groups: list):
    """Generate demand points inside AOI and weight by age groups if provided."""
    aoi_polygon = shape(aoi_geojson)
    # Example: we take building centroids or a regular grid — simplified here:
    gdf = ox.features_from_polygon(aoi_polygon, {"building": True})
    gdf = gdf[gdf.geometry.type == "Polygon"].copy()
    gdf["geometry"] = gdf.centroid
    gdf = gdf.reset_index(drop=True)
    # 📌 Add age data
    gdf = add_age_data_to_points(gdf)
    if selected_age_groups:
        # sum population in selected brackets
        gdf["weight"] = gdf[selected_age_groups].sum(axis=1)
    else:
        gdf["weight"] = 1.0
    return gdf[["geometry", "weight"]]

from shapely.geometry import shape, Polygon, Point
import geopandas as gpd
import numpy as np
import json
from core.osm_loader import get_candidate_sites
from core.distance import compute_distance_matrix
from core.mclp_solver import solve_mclp
from models.request_models import OptimizeRequest

def run_mclp_model(req: OptimizeRequest):
    """
    Runs the Maximal Covering Location Problem (MCLP) optimization.
    Dynamically generates demand points inside AOI and computes actual coverage metrics.
    """
    aoi_shape = shape(req.aoi["features"][0]["geometry"])

    # Map candidate types to OSM tags
    tags = {"amenity": [], "leisure": []}
    for t in req.candidate_types:
        if t in ["school", "library", "community_centre", "place_of_worship"]:
            tags["amenity"].append(t)
        elif t == "park":
            tags["leisure"].append(t)
    tags = {k: v for k, v in tags.items() if v}
    if not tags:
        raise ValueError("No valid tags passed.")

    # Get candidate sites within AOI
    candidates_gdf = get_candidate_sites(aoi_shape, tags)
    if candidates_gdf.empty:
        raise ValueError("No candidate sites found within the AOI.")

    # Generate grid of demand points within AOI
    minx, miny, maxx, maxy = aoi_shape.bounds
    grid_spacing_m = req.radius_m / 2.0  # spacing = half the service radius
    deg_per_meter = 1 / 111320  # rough conversion

    x_coords = np.arange(minx, maxx, grid_spacing_m * deg_per_meter)
    y_coords = np.arange(miny, maxy, grid_spacing_m * deg_per_meter)

    points = []
    for x in x_coords:
        for y in y_coords:
            p = Point(x, y)
            if aoi_shape.contains(p):
                points.append(p)

    if not points:
        raise ValueError("No demand points generated within the AOI.")

    demand_gdf = gpd.GeoDataFrame(geometry=points, crs="EPSG:4326")
    selected_age_groups = req.age_groups if hasattr(req, "age_groups") else []   # ➕ NEW LINE
    age_brackets = ['<15', '15-35', '35-60', '60+']                              # ➕ NEW LINE
    for bracket in age_brackets:                                                 # ➕ NEW BLOCK
        demand_gdf[bracket] = np.random.randint(0, 100, size=len(demand_gdf))    # ➕ Simulated demographic data

    if selected_age_groups:                                                      # ➕ NEW BLOCK
        demand_gdf["weight"] = demand_gdf[selected_age_groups].sum(axis=1)
    else:
        demand_gdf["weight"] = 1.0
        
    demand_weights = demand_gdf["weight"].tolist()
    # demand_weights = [1] * len(demand_gdf)

    # Compute distance matrix between demand points and candidates
    dm = compute_distance_matrix(demand_gdf.geometry, candidates_gdf.geometry)

    # Run MCLP solver
    selected_idxs = solve_mclp(demand_weights, dm, req.radius_m, req.p)
    selected_sites = candidates_gdf.iloc[selected_idxs]

    # --- Compute actual coverage ---
    selected_geoms = selected_sites.geometry.to_list()
    demand_geoms = demand_gdf.geometry.to_list()

    covered = []
    for dp in demand_geoms:
        is_covered = any(dp.distance(fac) * 111320 <= req.radius_m for fac in selected_geoms)
        covered.append(is_covered)

    total_demand = len(demand_geoms)
    covered_demand = sum(covered)
    selected_count = len(selected_idxs)
    coverage_rate = covered_demand / total_demand if total_demand > 0 else 0.0

    # Return results
    return {
        "metrics": {
            "total_demand": total_demand,
            "selected_count": selected_count,
            "coverage_rate": coverage_rate,
            "covered_demand": covered_demand,
        },
        "selected_sites": json.loads(selected_sites.to_crs(4326).to_json()),
        "candidates": json.loads(candidates_gdf.to_crs(4326).to_json()),
        "demand_points": json.loads(demand_gdf.to_crs(4326).to_json()),
        "alternatives": [
            {
                "id": row.name,
                "name": row.get("name", "Unknown"),
                "coverage": 1.0
            }
            for _, row in selected_sites.iterrows()
        ]
    }

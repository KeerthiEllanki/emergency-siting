from shapely.geometry import Point
import numpy as np

def compute_distance_matrix(demand_points, facility_points):
    
    # Use Euclidean distance (lat/lng ~ meters for small areas)
    dm = np.zeros((len(demand_points), len(facility_points)))
    for i, d in enumerate(demand_points):
        for j, f in enumerate(facility_points):
            dm[i, j] = d.distance(f)
    return dm

import numpy as np
from pulp import LpMaximize, LpProblem, LpVariable, lpSum

def solve_mclp(demand_weights, distance_matrix, radius, p):
    n_demands, n_sites = distance_matrix.shape

    x = [LpVariable(f"x_{j}", cat="Binary") for j in range(n_sites)]
    y = [LpVariable(f"y_{i}", cat="Binary") for i in range(n_demands)]

    model = LpProblem("MCLP", LpMaximize)

    # Objective: Maximize weighted demand coverage
    model += lpSum(demand_weights[i] * y[i] for i in range(n_demands))

    # Coverage constraints
    for i in range(n_demands):
        covering_sites = [j for j in range(n_sites) if distance_matrix[i, j] <= radius]
        if covering_sites:
            model += y[i] <= lpSum(x[j] for j in covering_sites)
        else:
            model += y[i] == 0

    # Facility limit
    model += lpSum(x) <= p

    model.solve()
    selected = [j for j in range(n_sites) if x[j].varValue == 1]
    return selected

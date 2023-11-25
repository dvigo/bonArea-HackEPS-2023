import csv

from tsp import solve_tsp_with_or_tools
from datetime import datetime, timedelta

class OutputRow:
    def __init__(self, customer_id, ticket_id, x, y, picking, x_y_date_time):
        self.customer_id = customer_id
        self.ticket_id = ticket_id
        self.x = x
        self.y = y
        self.picking = picking
        self.x_y_date_time = x_y_date_time

    def __repr__(self):
        return f"{self.customer_id};{self.ticket_id};{self.x};{self.y};{self.picking};{self.x_y_date_time}"

class Planogram:
    def __init__(self, x, y, picking_x, picking_y, description):
        self.x = x
        self.y = y
        self.picking_x = picking_x
        self.picking_y = picking_y
        self.description = description

def parse_planogram(file_path):
    planogram_data = []
    with open(file_path, 'r') as file:
        reader = csv.DictReader(file, delimiter=';')
        for row in reader:
            # print(row)
            picking_x = int(row['picking_x']) if row['picking_x'] else None
            picking_y = int(row['picking_y']) if row['picking_y'] else None

            planogram_data.append(Planogram(int(row['x']), int(row['y']), 
                                            picking_x, picking_y, 
                                            row['description']))
    return planogram_data

class CustomerProperties:
    def __init__(self, customer_id, step_seconds, picking_offset):
        self.customer_id = customer_id
        self.step_seconds = step_seconds
        self.picking_offset = picking_offset

def parse_customer_properties(file_path):
    customer_properties = []
    with open(file_path, 'r') as file:
        reader = csv.DictReader(file, delimiter=';')
        for row in reader:
            customer_properties.append(CustomerProperties(row['customer_id'], 
                                                         int(row['step_seconds']), 
                                                         int(row['picking_offset'])))
    return customer_properties

class ArticlePickingTime:
    def __init__(self, article_id, article_name, first_pick, second_pick, third_pick, fourth_pick, fifth_more_pick):
        self.article_id = article_id
        self.article_name = article_name
        self.first_pick = first_pick
        self.second_pick = second_pick
        self.third_pick = third_pick
        self.fourth_pick = fourth_pick
        self.fifth_more_pick = fifth_more_pick

def parse_articles_picking_time(file_path):
    articles_picking_time = []
    with open(file_path, 'r') as file:
        reader = csv.DictReader(file, delimiter=';')
        for row in reader:
            articles_picking_time.append(ArticlePickingTime(row['article_id'], row['article_name'],
                                                           int(row['first_pick']), int(row['second_pick']),
                                                           int(row['third_pick']), int(row['fourth_pick']),
                                                           int(row['fifth_more_pick'])))
    return articles_picking_time


class Ticket:
    def __init__(self, enter_date_time, customer_id, article_id, quantity, ticket_id):
        self.enter_date_time = enter_date_time
        self.customer_id = customer_id
        self.article_id = article_id
        self.quantity = quantity
        self.ticket_id = ticket_id

def parse_tickets(file_path):
    tickets = []
    with open(file_path, 'r') as file:
        reader = csv.DictReader(file, delimiter=';')
        for row in reader:
            tickets.append(Ticket(row['enter_date_time'], row['customer_id'], 
                                  row['article_id'], int(row['quantity']), 
                                  row['ticket_id']))
    return tickets

# Assuming the above class and parser definitions are here

def get_product_locations(tickets, planogram_data):
    customer_product_locations = {}
    for ticket in tickets:
        customer_id = ticket.customer_id
        product_id = ticket.article_id

        # Initialize the list for the customer if it's their first product
        if customer_id not in customer_product_locations:
            customer_product_locations[customer_id] = []

        # Find the product location and add it to the customer's list
        for item in planogram_data:
            if item.description == product_id:
                customer_product_locations[customer_id].append((item.picking_x, item.picking_y))
                break
        else:
            print("Product {} not found in planogram data".format(product_id))
            raise Exception("Product {} not found in planogram data".format(product_id))

    return customer_product_locations

from search import a_star_search

def compute_all_pairs_shortest_paths(planogram_data, product_locations):
    # Prepare the grid based on planogram_data
    # 0 for open space, 1 for walls or obstacles
    # This grid should be constructed based on your planogram data layout
    grid_width = max([item.x for item in planogram_data]) + 1
    grid_height = max([item.y for item in planogram_data]) + 1
    grid = [[0 for _ in range(grid_height)] for _ in range(grid_width)]
    start_p = None
    ends = []
    for item in planogram_data:
        if item.description not in ['paso', 'paso-entrada', 'paso-salida']:
            grid[item.x][item.y] = 1

        if item.description == 'paso-entrada':
            start_p = (item.x, item.y)
        elif item.description == 'paso-salida':
            ends.append((item.x, item.y))
    
    product_locations = [start_p] + product_locations + ends

    all_pairs_shortest_paths = {}
    for start in product_locations:
        all_pairs_shortest_paths[start] = {}
        for goal in product_locations:
            if start != goal:
                path = a_star_search(grid, start, goal)
                if not path:
                    print("No path found from {} to {}".format(start, goal))
                    raise Exception("No path found from {} to {}".format(start, goal))
                all_pairs_shortest_paths[start][goal] = path

    return all_pairs_shortest_paths, start_p, ends

def build_distance_matrix_for_end(all_pairs_shortest_paths, locations, start, end):
    # Include start and end in the list of points
    points = [start] + locations + [end]

    # Initialize the distance matrix
    n = len(points)
    distance_matrix = [[0 for _ in range(n)] for _ in range(n)]

    # Populate the distance matrix
    for i, point1 in enumerate(points):
        for j, point2 in enumerate(points):
            if i != j:
                # print(point1, point2, i, j, start, end)
                # Retrieve the distance from the all_pairs_shortest_paths and assign it to the matrix
                distance_matrix[i][j] = len(all_pairs_shortest_paths[point1][point2]) - 1  # Subtract 1 for path length
    return distance_matrix, points

def find_optimal_route_with_ends(customers_product_locations, planogram_data):
    best_routes = {}
    for customer_id, locations in customers_product_locations.items():
        # Calculate shortest paths for all items and potential ends
        all_pairs_shortest_paths, start, ends = compute_all_pairs_shortest_paths(planogram_data, locations)
        # print(all_pairs_shortest_paths)
        # input('Debug distance matrix')

        best_route = None
        pick_at_steps = None
        best_route_length = float('inf')

        for end in ends:
            # Create a modified distance matrix for this end
            distance_matrix, points = build_distance_matrix_for_end(all_pairs_shortest_paths, locations, start, end)
            start_index = points.index(start)
            end_index = points.index(end)

            tsp_route = solve_tsp_with_or_tools(distance_matrix, start_index, end_index)
            route_length = calculate_route_length(tsp_route, distance_matrix)

            # Check if this route is better
            if route_length < best_route_length:
                best_route = [
                    points[i] for i in tsp_route
                ]
                best_route, pick_at_steps = reconstruct_full_path(best_route, all_pairs_shortest_paths)
                best_route_length = route_length
                # print(f'New best route for Customer {customer_id}:', best_route, best_route_length)
        print(f'Best route for Customer {customer_id}:', best_route, best_route_length)
        print('Pick at steps:', pick_at_steps)
        best_routes[customer_id] = best_route, pick_at_steps
        if len(best_routes) == 10:
            return best_routes
    print('Number of customers:', len(best_routes))
    return best_routes

# Additional function to calculate the total length of a route
def calculate_route_length(route, distance_matrix):
    total_length = 0
    for i in range(len(route) - 1):
        total_length += distance_matrix[route[i]][route[i + 1]]
    return total_length


def main():
    # Base directory for data files
    base_dir = './data/'

    # Paths to the data files, now relative to the 'data' directory
    planogram_file_path = base_dir + 'planogram_table.csv'
    customer_properties_file_path = base_dir + 'hackathon_customers_properties.csv'
    articles_picking_time_file_path = base_dir + 'hackathon_article_picking_time.csv'
    tickets_file_path = base_dir + 'hackathon_tickets.csv'

    # Load the data using the parsers
    planogram_data = parse_planogram(planogram_file_path)
    customer_properties = parse_customer_properties(customer_properties_file_path)
    articles_picking_time = parse_articles_picking_time(articles_picking_time_file_path)
    tickets = parse_tickets(tickets_file_path)

    # For demonstration, let's print the first few entries of each dataset
    # print("Planogram Data Sample:")
    # for item in planogram_data[:3]:
    #     print(vars(item))

    # print("\nCustomer Properties Sample:")
    # for item in customer_properties[:3]:
    #     print(vars(item))

    # print("\nArticles Picking Time Sample:")
    # for item in articles_picking_time[:3]:
    #     print(vars(item))

    # print("\nTickets Sample:")
    # for item in tickets[:3]:
    #     print(vars(item))

    customers_product_locations = get_product_locations(tickets, planogram_data)

    best_routes = find_optimal_route_with_ends(customers_product_locations, planogram_data)
    output_rows = generate_output_rows(best_routes, customer_properties, articles_picking_time, tickets, planogram_data)

    # Write the output to a file
    with open('data/output_good.csv', 'w') as file:
        file.write('customer_id;ticket_id;x;y;picking;x_y_date_time\n')
        for row in output_rows:
            file.write(str(row) + '\n')

from datetime import datetime, timedelta

def parse_datetime(datetime_str):
    # Assuming the datetime string format is known, e.g., '2023-11-02 09:29:00'
    # Adjust the format accordingly if it's different
    return datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')


def generate_output_rows(best_routes, customer_properties: [CustomerProperties], articles_picking_time: [ArticlePickingTime], tickets, planogram_data):
    output_rows = []

    for customer_id, (path, pick_at_steps) in best_routes.items():
        # Find the customer's properties and ticket info
        customer_prop = next((cp for cp in customer_properties if cp.customer_id == customer_id), None)
        customer_tickets = [t for t in tickets if t.customer_id == customer_id]

        total_quantity = sum(ticket.quantity for ticket in customer_tickets)
        # Initialize the start time from the ticket entry time
        current_time = min(parse_datetime(ticket.enter_date_time) for ticket in customer_tickets)

        for i, (x, y) in enumerate(path):
            # Check if the current position is a picking location and identify the item
            picking = 0
            time_at_position = 0

            if i in pick_at_steps:
                # User is picking an item at this position
                picking = 1
                article_id = next((p.description for p in planogram_data if p.picking_x == x and p.picking_y == y), None)
                article_pick_time = next((apt for apt in articles_picking_time if apt.article_id == article_id), None)
                
                if article_pick_time:
                    # Adjust time at position based on the number of items picked
                    quantity = next((ticket.quantity for ticket in customer_tickets if ticket.article_id == article_id), 1)
                    time_at_position += sum([article_pick_time.first_pick, 
                                             *(article_pick_time.second_pick for _ in range(1, min(quantity, 2))),
                                             *(article_pick_time.third_pick for _ in range(2, min(quantity, 3))),
                                             *(article_pick_time.fourth_pick for _ in range(3, min(quantity, 4))),
                                             *(article_pick_time.fifth_more_pick for _ in range(4, quantity))])
            else:
                # User is moving to this position
                time_at_position = customer_prop.step_seconds

            # Create an OutputRow for each second spent at the current position
            for _ in range(time_at_position):
                output_rows.append(OutputRow(customer_id, customer_tickets[0].ticket_id, x, y, picking, current_time))
                current_time += timedelta(seconds=1)
        x_checkout = x
        y_checkout = y
        time_checkout = total_quantity * 5 + customer_prop.step_seconds
        for _ in range(time_checkout):
            output_rows.append(OutputRow(customer_id, customer_tickets[0].ticket_id, x_checkout, y_checkout, 0, current_time))
            current_time += timedelta(seconds=1)
                

    # Sort the rows by x_y_date_time
    output_rows.sort(key=lambda row: row.x_y_date_time)
    return output_rows

def reconstruct_full_path(tsp_route, all_pairs_shortest_paths):
    full_path = [
        tsp_route[0]
    ]
    pick_at_steps = []
    for i in range(len(tsp_route) - 1):
        start_point = tsp_route[i]
        end_point = tsp_route[i + 1]

        # Retrieve the path between start_point and end_point
        path_segment = all_pairs_shortest_paths[start_point][end_point][::-1]
        
        # Add the path segment to the full path
        # Exclude the last point to avoid duplicates with the next segment
        full_path.extend(path_segment)
        pick_at_steps.append(len(full_path) - 1)

    return full_path, pick_at_steps




if __name__ == "__main__":
    main()

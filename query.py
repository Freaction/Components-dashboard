import sqlite3
import json

conn = sqlite3.connect('data/main.sqlite')
cursor = conn.cursor()
cursor.execute("SELECT bound_variables_json FROM node_metadata WHERE bound_variables_json LIKE '%VARIABLE_ALIAS%' LIMIT 5")
rows = cursor.fetchall()
for row in rows:
    print(row[0])

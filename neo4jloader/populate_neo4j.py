from neo4j.v1 import GraphDatabase, basic_auth
from neo4j.exceptions import ServiceUnavailable, ClientError, AuthError, SecurityError
from time import sleep
import sys
import os

neo4j_uid, neo4j_pwd = os.environ['NEO4J_AUTH'].split('/')

secondsToSleep = 10

for i in range(10,0,-1):
    try:
        driver = GraphDatabase.driver("bolt://neo4j:7687", auth=basic_auth(neo4j_uid, neo4j_pwd))
        session = driver.session()
    except (ServiceUnavailable, ClientError, AuthError, SecurityError) as e:
        if i == 1:
            raise
        sleep(secondsToSleep)
        print('retry %d after catching %s; sleeping for %d seconds' % (i,str(e), secondsToSleep))
    else:
        break    
        
result = session.run('MERGE (g:genre {name:"pop"}) ON CREATE SET g.created = timestamp()')
result = session.run("MATCH (a:genre) RETURN count(a) as numberOfGenres")

for record in result:
    print >> sys.stderr, record

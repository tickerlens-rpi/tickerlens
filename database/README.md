# database (Postgres, internal only)

Holds everything: the cached stock data (`cache` table) and the scheduler's watchlist (`watchlist` table).
There is no code here. The central API and the scheduler create the tables when they start.

Nothing outside the compose network can reach it (no published port). Data lives in the `db_data` volume.

Look inside:

    docker compose exec database psql -U tickerlens -c "select kind, ticker, param from cache"
    docker compose exec database psql -U tickerlens -c "select * from watchlist"

Wipe everything (careful): `docker compose down -v`

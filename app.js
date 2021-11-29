const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

//Initialize Database
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000")
    );
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//Authentication Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfgh", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT 
        *
    FROM
        user
    WHERE
        username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "asdfgh");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const dbUser = await db.get(getStateQuery);
  response.send(convertStateDbObjectToResponseObject(dbUser));
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
  VALUES( '${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths}); `;

  const dbUser = db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT * FROM district WHERE district_id = ${districtId};`;
    const dbUser = await db.get(getDistrictQuery);
    if (dbUser === undefined) {
      response.send("No District Found With the Mentioned Id");
    } else {
      response.send(convertDistrictDbObjectToResponseObject(dbUser));
    }
  }
);

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT * FROM district WHERE district_id = ${districtId};`;
    const dbUser1 = await db.get(getDistrictQuery);
    if (dbUser1 === undefined) {
      response.status(400);
      response.send("Invalid District ID");
    } else {
      const deleteDistrictQuery = `
        DELETE FROM district WHERE district_id = ${districtId};`;
      const dbUser = await db.get(deleteDistrictQuery);
      response.send("District Removed");
    }
  }
);

app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const getDistrictQuery = `
        SELECT * FROM district WHERE district_id = ${districtId};`;
    const dbUser1 = await db.get(getDistrictQuery);
    if (dbUser1 === undefined) {
      response.status(400);
      response.send("Invalid District ID");
    } else {
      const updateDistrictQuery = `
       UPDATE
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active}, 
    deaths = ${deaths}
  WHERE
    district_id = ${districtId};
  `;
      const dbUser = await db.get(updateDistrictQuery);
      response.send("District Details Updated");
    }
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateIdQuery = `
    SELECT state_id FROM district WHERE state_id = ${stateId};`;
    const dbUser = await db.get(getStateIdQuery);

    if (dbUser === undefined) {
      response.send("No such State");
      response.status(400);
    } else {
      const getStateStatsQuery = `
        SELECT
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
        FROM
        district
        WHERE
        state_id=${stateId};`;
      const stats = await db.get(getStateStatsQuery);
      response.send({
        totalCases: stats["SUM(cases)"],
        totalCured: stats["SUM(cured)"],
        totalActive: stats["SUM(active)"],
        totalDeaths: stats["SUM(deaths)"],
      });
    }
  }
);

module.exports = app;

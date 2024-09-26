require('dotenv').config(); // Load environment variables

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies
app.use(express.json());

// Load city parameters
let cityParams = {};
try {
  const data = fs.readFileSync('cityParams.json', 'utf8');
  cityParams = JSON.parse(data);

  // Replace bmsId and token with environment variables if available
  Object.keys(cityParams).forEach(cityCode => {
    const envBmsId = process.env[`BMS_ID_${cityCode}`];
    const envToken = process.env[`TOKEN_${cityCode}`];
    if (envBmsId) cityParams[cityCode].bmsId = envBmsId;
    if (envToken) cityParams[cityCode].token = envToken;
  });

  console.log('City parameters loaded successfully.');
} catch (err) {
  console.error('Error reading cityParams.json:', err);
  process.exit(1); // Exit if cityParams.json is not found or invalid
}

// API Endpoint to get list of cities
app.get('/api/get-cities', (req, res) => {
  const cities = Object.keys(cityParams).map(code => ({
    code: code,
    name: cityParams[code].name
  }));
  res.json(cities);
});

// API Endpoint to fetch showtime data for selected cities
app.post('/api/fetch-showtimes', async (req, res) => {
  const { selectedCities } = req.body;

  if (!selectedCities || !Array.isArray(selectedCities) || selectedCities.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty selectedCities array.' });
  }

  let allResults = [];
  let errors = [];

  for (const cityCode of selectedCities) {
    const params = cityParams[cityCode];
    if (!params) {
      const errorMsg = `Invalid city code: ${cityCode}`;
      console.warn(errorMsg);
      errors.push(errorMsg);
      continue; // Skip invalid city codes
    }

    const url = `https://in.bookmyshow.com/api/movies-data/showtimes-by-event?appCode=MOBAND2&appVersion=14304&language=en&eventCode=ET00310216&regionCode=${params.regionCode}&subRegion=${params.subRegionCode}&bmsId=${params.bmsId}&token=${params.token}&lat=${params.lat}&lon=${params.lon}&query=`;

    const headers = {
      "Host": "in.bookmyshow.com",
      "x-bms-id": params.bmsId,
      "x-region-code": params.regionCode,
      "x-subregion-code": params.subRegionCode,
      "x-region-slug": cityCode.toLowerCase(), // Assuming slug is lowercase city code
      "x-platform": "AND",
      "x-platform-code": "ANDROID",
      "x-app-code": "MOBAND2",
      "x-device-make": "Google-Pixel XL",
      "x-screen-height": "2392",
      "x-screen-width": "1440",
      "x-screen-density": "3.5",
      "x-app-version": "14.3.4",
      "x-app-version-code": "14304",
      "x-network": "Android | WIFI",
      "x-latitude": params.lat,
      "x-longitude": params.lon,
      "lang": "en",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    };

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        const errorBody = await response.text(); // Capture response body
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }

      const data = await response.json();

      // Process the data
      data.ShowDetails.forEach(showDetail => {
        showDetail.Venues.forEach(venue => {
          venue.ShowTimes.forEach(showTime => {
            showTime.Categories.forEach(category => {
              const maxSeats = parseInt(category.MaxSeats, 10) || 0;
              const seatsAvail = parseInt(category.SeatsAvail, 10) || 0;
              const bookedTickets = maxSeats - seatsAvail;
              const currentPrice = parseFloat(category.CurPrice) || 0;

              // Extract Area Name
              let [venueName, areaName] = venue.VenueName.split(':');
              if (!areaName) areaName = 'Unknown';

              // Calculate occupancy
              const occupancy = maxSeats > 0 ? ((bookedTickets / maxSeats) * 100).toFixed(2) : '0.00';

              allResults.push({
                VenueName: venueName.trim(),
                Area: areaName.trim(),
                ShowTime: showTime.ShowTime,
                Category: category.CatName,
                MaxSeats: maxSeats,
                SeatsAvailable: seatsAvail,
                BookedTickets: bookedTickets,
                Occupancy: parseFloat(occupancy),
                Price: currentPrice,
                TotalGross: (maxSeats * currentPrice).toFixed(2),
                BookedGross: (bookedTickets * currentPrice).toFixed(2),
                City: cityCode // Add City information for Overall Summary
              });
            });
          });
        });
      });

    } catch (error) {
      console.error(`Error fetching showtimes for city ${cityCode}:`, error.message);
      errors.push(`City ${cityCode}: ${error.message}`);
      // Continue fetching data for other cities even if one fails
    }
  }

  if (errors.length > 0) {
    res.status(207).json({ data: allResults, errors });
  } else {
    res.json({ data: allResults });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

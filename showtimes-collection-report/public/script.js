document.addEventListener('DOMContentLoaded', () => {
    const cityDropdown = document.getElementById('city-dropdown');
    const loadingIndicator = document.getElementById('loading');
    const tableContainer = document.getElementById('table-container');
    const searchBox = document.getElementById('search-box');
    const navLinks = document.querySelectorAll('#nav-links a');
  
    let globalData = []; // Store fetched data
    let totalRowData = {}; // Store total row data
    let currentTable = 'overall'; // Default table
  
    // Function to populate the city dropdown by fetching from server
    async function populateCityDropdown() {
      try {
        const response = await fetch('/api/get-cities');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const cities = await response.json();
        cities.forEach(city => {
          const option = document.createElement('option');
          option.value = city.code;
          option.text = city.name;
          cityDropdown.appendChild(option);
        });
      } catch (error) {
        console.error('Error fetching cities:', error);
        alert('Failed to load cities. Please try again later.');
      }
    }
  
    // Fetch initial data for default selection
    async function fetchInitialData() {
      // Select default cities (WAR)
      const selectedCities = ['WAR'];
      // Select the default option in the dropdown
      Array.from(cityDropdown.options).forEach(option => {
        if (selectedCities.includes(option.value)) {
          option.selected = true;
        }
      });
      await fetchShowtimes(selectedCities);
    }
  
    // Function to fetch showtimes data from server
    async function fetchShowtimes(selectedCities) {
      loadingIndicator.style.display = 'block';
      try {
        const response = await fetch('/api/fetch-showtimes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedCities })
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const result = await response.json();
        globalData = result.data;
        renderTable(currentTable);
        applySearchFilter();
      } catch (error) {
        console.error('Error fetching showtimes:', error);
        alert('Failed to fetch showtimes data. Please try again later.');
      } finally {
        loadingIndicator.style.display = 'none';
      }
    }
  
    // Function to calculate totals based on table type
    function calculateTotals(data, tableType) {
      if (tableType === 'overall') {
        // Group data by City for Overall Summary
        const grouped = groupData(data, ['City'], 'overall');
        totalRowData = {
          CityCount: grouped.length,
          TheaterCount: grouped.reduce((sum, row) => sum + row.TheaterCount, 0),
          ShowCount: grouped.reduce((sum, row) => sum + row.ShowCount, 0),
          TotalTickets: grouped.reduce((sum, row) => sum + row.TotalTickets, 0),
          BookedTickets: grouped.reduce((sum, row) => sum + row.BookedTickets, 0),
          TotalGross: grouped.reduce((sum, row) => sum + parseFloat(row.TotalGross), 0).toFixed(2),
          BookedGross: grouped.reduce((sum, row) => sum + parseFloat(row.BookedGross), 0).toFixed(2),
          Occupancy: (grouped.reduce((sum, row) => sum + (row.TotalTickets > 0 ? (row.BookedTickets / row.TotalTickets) * 100 : 0), 0) / grouped.length).toFixed(2)
        };
      } else {
        let totalMaxSeats = 0;
        let totalSeatsAvailable = 0;
        let totalBookedTickets = 0;
        let totalGross = 0;
        let bookedGross = 0;
        let theaterCount = 0;
        let showCount = 0;
  
        if (tableType === 'city' || tableType === 'area') {
          const uniqueTheaters = new Set();
          const uniqueShows = new Set();
  
          data.forEach(row => {
            uniqueTheaters.add(row.VenueName);
            uniqueShows.add(`${row.VenueName} | ${row.ShowTime}`);
            totalMaxSeats += row.MaxSeats;
            totalSeatsAvailable += row.SeatsAvailable;
            totalBookedTickets += row.BookedTickets;
            totalGross += parseFloat(row.TotalGross);
            bookedGross += parseFloat(row.BookedGross);
          });
  
          theaterCount = uniqueTheaters.size;
          showCount = uniqueShows.size;
        } else if (tableType === 'theater') {
          const uniqueShows = new Set();
  
          data.forEach(row => {
            uniqueShows.add(row.ShowTime);
            totalMaxSeats += row.MaxSeats;
            totalSeatsAvailable += row.SeatsAvailable;
            totalBookedTickets += row.BookedTickets;
            totalGross += parseFloat(row.TotalGross);
            bookedGross += parseFloat(row.BookedGross);
          });
  
          showCount = uniqueShows.size;
        } else {
          // For other table types, calculate only the sums
          data.forEach(row => {
            totalMaxSeats += row.MaxSeats;
            totalSeatsAvailable += row.SeatsAvailable;
            totalBookedTickets += row.BookedTickets;
            totalGross += parseFloat(row.TotalGross);
            bookedGross += parseFloat(row.BookedGross);
          });
        }
  
        const totalOccupancy = totalMaxSeats > 0 ? ((totalBookedTickets / totalMaxSeats) * 100).toFixed(2) : '0.00';
  
        totalRowData = {
          MaxSeats: totalMaxSeats,
          SeatsAvailable: totalSeatsAvailable,
          BookedTickets: totalBookedTickets,
          Occupancy: parseFloat(totalOccupancy),
          TotalGross: totalGross.toFixed(2),
          BookedGross: bookedGross.toFixed(2)
        };
  
        if (tableType === 'city' || tableType === 'area') {
          totalRowData.TheaterCount = theaterCount;
          totalRowData.ShowCount = showCount;
        } else if (tableType === 'theater') {
          totalRowData.ShowCount = showCount;
        }
      }
    }
  
    // Function to render the table based on table type
    function renderTable(tableType) {
      tableContainer.innerHTML = '';
  
      let dataToRender = [];
      let headers = [];
      let headerToKeyMap = {};
  
      switch (tableType) {
        case 'overall':
          dataToRender = groupData(globalData, ['City'], 'overall');
          headers = ["Index", "City", "Theater Count", "Show Count", "Total Tickets", "Booked Tickets", "Total Gross", "Booked Gross", "Occupancy (%)"];
          headerToKeyMap = {
            "City": "City",
            "Theater Count": "TheaterCount",
            "Show Count": "ShowCount",
            "Total Tickets": "TotalTickets",
            "Booked Tickets": "BookedTickets",
            "Total Gross": "TotalGross",
            "Booked Gross": "BookedGross",
            "Occupancy (%)": "Occupancy"
          };
          // Calculate totals over the grouped data
          calculateTotals(dataToRender, 'overall');
          break;
  
        case 'city':
          calculateTotals(globalData, 'city');
          headers = ["Index", "Theater Count", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"];
          headerToKeyMap = {
            "Theater Count": "TheaterCount",
            "Show Count": "ShowCount",
            "Max Seats": "MaxSeats",
            "Seats Available": "SeatsAvailable",
            "Booked Tickets": "BookedTickets",
            "Occupancy (%)": "Occupancy",
            "Total Gross": "TotalGross",
            "Booked Gross": "BookedGross"
          };
          dataToRender = [totalRowData];
          break;
  
        case 'area':
          dataToRender = groupData(globalData, ['Area'], 'area');
          headers = ["Index", "Area", "Theater Count", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"];
          headerToKeyMap = {
            "Area": "Area",
            "Theater Count": "TheaterCount",
            "Show Count": "ShowCount",
            "Max Seats": "MaxSeats",
            "Seats Available": "SeatsAvailable",
            "Booked Tickets": "BookedTickets",
            "Occupancy (%)": "Occupancy",
            "Total Gross": "TotalGross",
            "Booked Gross": "BookedGross"
          };
          break;
  
        case 'theater':
          dataToRender = groupData(globalData, ['Area', 'VenueName'], 'theater');
          headers = ["Index", "Area", "Venue Name", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"];
          headerToKeyMap = {
            "Area": "Area",
            "Venue Name": "VenueName",
            "Show Count": "ShowCount",
            "Max Seats": "MaxSeats",
            "Seats Available": "SeatsAvailable",
            "Booked Tickets": "BookedTickets",
            "Occupancy (%)": "Occupancy",
            "Total Gross": "TotalGross",
            "Booked Gross": "BookedGross"
          };
          break;
  
        case 'showtime':
          dataToRender = groupData(globalData, ['Area', 'VenueName', 'ShowTime'], 'showtime');
          headers = ["Index", "Area", "Venue Name", "Show Time", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"];
          headerToKeyMap = {
            "Area": "Area",
            "Venue Name": "VenueName",
            "Show Time": "ShowTime",
            "Max Seats": "MaxSeats",
            "Seats Available": "SeatsAvailable",
            "Booked Tickets": "BookedTickets",
            "Occupancy (%)": "Occupancy",
            "Total Gross": "TotalGross",
            "Booked Gross": "BookedGross"
          };
          break;
  
        case 'category':
          dataToRender = globalData;
          headers = ["Index", "City", "Area", "Venue Name", "Show Time", "Category", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Price", "Total Gross", "Booked Gross"];
          headerToKeyMap = {
            "City": "City",
            "Area": "Area",
            "Venue Name": "VenueName",
            "Show Time": "ShowTime",
            "Category": "Category",
            "Max Seats": "MaxSeats",
            "Seats Available": "SeatsAvailable",
            "Booked Tickets": "BookedTickets",
            "Occupancy (%)": "Occupancy",
            "Price": "Price",
            "Total Gross": "TotalGross",
            "Booked Gross": "BookedGross"
          };
          break;
      }
  
      // Create table and headers
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
  
      headers.forEach((headerText, index) => {
        const th = document.createElement('th');
        th.innerText = headerText;
        // Add specific class for Index header for styling
        if (headerText === "Index") {
          th.classList.add('index-header');
        }
        // Only make columns sortable if they are not the Index column
        if (headerText !== "Index") {
          th.classList.add('sortable');
          th.addEventListener('click', () => sortTableByColumn(index, tableType));
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
  
      // Create table body
      const tbody = document.createElement('tbody');
      tbody.id = 'table-body';
  
      dataToRender.forEach((row, idx) => {
        const tr = document.createElement('tr');
        headers.forEach((headerText, index) => {
          const td = document.createElement('td');
          if (headerText === "Index") {
            td.innerText = idx + 1;
            td.classList.add('index-cell');
          } else {
            const key = headerToKeyMap[headerText];
            let value = row[key];
            if (key === 'Occupancy') {
              td.innerText = value.toFixed(2) + '%';
            } else if (['TotalGross', 'BookedGross', 'Price'].includes(key)) {
              td.innerText = parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else if (['TheaterCount', 'ShowCount', 'CityCount', 'TotalTickets'].includes(key)) {
              td.innerText = value;
            } else {
              td.innerText = value;
            }
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
  
      // Add total row if not 'overall' summary
      if (tableType !== 'overall') {
        calculateTotals(dataToRender, tableType);
        const totalTr = document.createElement('tr');
        totalTr.classList.add('total-row');
        headers.forEach((headerText, index) => {
          const key = headerToKeyMap[headerText];
          const td = document.createElement('td');
          if (headerText === "Index") {
            td.innerText = ''; // No index for total row
          } else if (headerText === 'City' || headerText === 'Area') {
            td.innerText = 'TOTAL';
          } else if (['Theater Count', 'Show Count', 'CityCount', 'TotalTickets'].includes(headerText)) {
            td.innerText = totalRowData[key];
          } else if (key === 'Occupancy') {
            td.innerText = parseFloat(totalRowData[key]).toFixed(2) + '%';
          } else if (['TotalGross', 'BookedGross'].includes(key)) {
            td.innerText = parseFloat(totalRowData[key]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          } else {
            td.innerText = totalRowData[key];
          }
          totalTr.appendChild(td);
        });
        tbody.appendChild(totalTr);
      }
  
      table.appendChild(tbody);
      tableContainer.appendChild(table);
    }
  
    // Function to group data based on specified keys
    function groupData(data, groupByKeys, tableType) {
      const groupedData = {};
  
      data.forEach(item => {
        const groupKey = groupByKeys.map(key => item[key]).join(' | ');
  
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = {
            ...groupByKeys.reduce((acc, key) => ({ ...acc, [key]: item[key] }), {}),
            TotalTickets: 0,
            BookedTickets: 0,
            TotalGross: 0,
            BookedGross: 0,
            venueSet: new Set(),
            showSet: new Set(),
            TheaterCount: 0,
            ShowCount: 0
          };
        }
  
        if (tableType === 'overall') {
          groupedData[groupKey].TotalTickets += item.MaxSeats;
          groupedData[groupKey].BookedTickets += item.BookedTickets;
        } else {
          groupedData[groupKey].MaxSeats = (groupedData[groupKey].MaxSeats || 0) + item.MaxSeats;
          groupedData[groupKey].SeatsAvailable = (groupedData[groupKey].SeatsAvailable || 0) + item.SeatsAvailable;
          groupedData[groupKey].BookedTickets = (groupedData[groupKey].BookedTickets || 0) + item.BookedTickets;
        }
  
        groupedData[groupKey].TotalGross += parseFloat(item.TotalGross);
        groupedData[groupKey].BookedGross += parseFloat(item.BookedGross);
  
        if (tableType === 'overall' || tableType === 'city' || tableType === 'area') {
          groupedData[groupKey].venueSet.add(item.VenueName);
          groupedData[groupKey].showSet.add(`${item.VenueName} | ${item.ShowTime}`);
        } else if (tableType === 'theater') {
          groupedData[groupKey].showSet.add(item.ShowTime);
        }
      });
  
      // Now calculate counts and remove temporary sets
      const result = Object.values(groupedData).map(group => {
        if (tableType === 'overall') {
          group.TheaterCount = group.venueSet.size;
          group.ShowCount = group.showSet.size;
        } else if (tableType === 'city' || tableType === 'area') {
          group.TheaterCount = group.venueSet.size;
          group.ShowCount = group.showSet.size;
        } else if (tableType === 'theater') {
          group.ShowCount = group.showSet.size;
        }
  
        delete group.venueSet;
        delete group.showSet;
  
        if (tableType === 'overall') {
          const occupancy = group.TotalTickets > 0 ? ((group.BookedTickets / group.TotalTickets) * 100).toFixed(2) : '0.00';
          return {
            ...group,
            Occupancy: parseFloat(occupancy)
          };
        } else {
          const occupancy = group.MaxSeats > 0 ? ((group.BookedTickets / group.MaxSeats) * 100).toFixed(2) : '0.00';
          return {
            ...group,
            Occupancy: parseFloat(occupancy),
            TotalGross: group.TotalGross.toFixed(2),
            BookedGross: group.BookedGross.toFixed(2)
          };
        }
      });
  
      return result;
    }
  
    // Function to sort the table by a specific column
    function sortTableByColumn(columnIndex, tableType) {
      // Prevent sorting if Index column is clicked
      if (columnIndex === 0) return;
  
      // Define headersMap to match headers
      const headersMap = {
        'overall': ["Index", "City", "Theater Count", "Show Count", "Total Tickets", "Booked Tickets", "Total Gross", "Booked Gross", "Occupancy (%)"],
        'city': ["Index", "Theater Count", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"],
        'area': ["Index", "Area", "Theater Count", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"],
        'theater': ["Index", "Area", "Venue Name", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"],
        'showtime': ["Index", "Area", "Venue Name", "Show Time", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"],
        'category': ["Index", "City", "Area", "Venue Name", "Show Time", "Category", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Price", "Total Gross", "Booked Gross"]
      };
  
      const headerText = headersMap[tableType][columnIndex];
      const key = headerText.replace(/ /g, '');
  
      if (!keyMap[headerText] && key !== 'City' && key !== 'Area') return; // If key is undefined (e.g., Index column), do nothing
  
      const sortKey = keyMap[headerText] || key;
  
      // Toggle sort direction
      if (sortTableByColumn.lastColumnIndex === columnIndex) {
        sortTableByColumn.descending = !sortTableByColumn.descending;
      } else {
        sortTableByColumn.descending = false;
      }
      sortTableByColumn.lastColumnIndex = columnIndex;
  
      // Get the data to sort
      let dataToSort;
      if (tableType === 'category') {
        dataToSort = [...globalData];
      } else if (tableType === 'overall') {
        dataToSort = groupData(globalData, ['City'], 'overall');
      } else {
        const groupByKeys = headersMap[tableType].slice(1).map(header => header.replace(/ /g, ''));
        dataToSort = groupData(globalData, groupByKeys, tableType);
      }
  
      dataToSort.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
  
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
  
        if (valA < valB) return sortTableByColumn.descending ? 1 : -1;
        if (valA > valB) return sortTableByColumn.descending ? -1 : 1;
        return 0;
      });
  
      // Update globalData if 'category'
      if (tableType === 'category') {
        globalData = dataToSort;
      }
  
      // Re-render the table with sorted data
      renderTable(tableType);
      // Re-apply search filter
      applySearchFilter();
    }
  
    // Initialize sort direction
    sortTableByColumn.descending = false;
    sortTableByColumn.lastColumnIndex = -1;
  
    // Function to apply search filter
    function applySearchFilter() {
      const filter = searchBox.value.toLowerCase();
      const tbody = document.getElementById('table-body');
      if (!tbody) return;
      const rows = Array.from(tbody.getElementsByTagName('tr'));
  
      // Remove the total row from the array if it exists
      let totalRow = null;
      if (currentTable !== 'overall') {
        totalRow = rows.pop();
      }
  
      rows.forEach(row => {
        const cells = row.getElementsByTagName('td');
        let rowContainsFilter = false;
  
        for (let j = 1; j < cells.length; j++) { // Start from 1 to skip Index column
          const cellText = cells[j].innerText.toLowerCase();
          if (cellText.indexOf(filter) > -1) {
            rowContainsFilter = true;
            break;
          }
        }
  
        row.style.display = rowContainsFilter ? '' : 'none';
      });
  
      // Recalculate totals based on filtered data if not 'overall' table
      if (currentTable !== 'overall') {
        const visibleRows = rows.filter(row => row.style.display !== 'none');
        const filteredData = visibleRows.map(row => {
          const cells = row.getElementsByTagName('td');
          const rowData = {};
          const headers = tbody.parentNode.tHead.rows[0].cells;
  
          for (let i = 1; i < cells.length; i++) { // Start from 1 to skip Index column
            const headerText = headers[i].innerText.replace(/ /g, '');
            let value = cells[i].innerText;
            if (['MaxSeats', 'SeatsAvailable', 'BookedTickets', 'Occupancy(%)', 'TotalGross', 'BookedGross', 'TheaterCount', 'ShowCount', 'Price', 'CityCount', 'TotalTickets'].includes(headerText)) {
              value = parseFloat(value.replace(/,/g, '').replace('%', ''));
            }
            rowData[keyMap[headerText]] = value; // Use keyMap to assign correct keys
          }
          return rowData;
        });
  
        calculateTotals(filteredData, currentTable);
  
        // Update the total row
        if (totalRow) {
          const totalCells = totalRow.getElementsByTagName('td');
          const headers = tbody.parentNode.tHead.rows[0].cells;
  
          for (let i = 1; i < totalCells.length; i++) { // Start from 1 to skip Index column
            const headerText = headers[i].innerText.replace(/ /g, '');
            const key = keyMap[headerText];
            if (['CityCount', 'TheaterCount', 'ShowCount', 'TotalTickets'].includes(key)) {
              totalCells[i].innerText = totalRowData[key];
            } else if (key === 'Occupancy') {
              totalCells[i].innerText = parseFloat(totalRowData[key]).toFixed(2) + '%';
            } else if (['TotalGross', 'BookedGross', 'Price'].includes(key)) {
              totalCells[i].innerText = parseFloat(totalRowData[key]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else {
              totalCells[i].innerText = totalRowData[key];
            }
          }
        }
      }
  
      // For 'overall' table, no need to recalculate totals
    }
  
    // Function to group data based on specified keys
    function groupData(data, groupByKeys, tableType) {
      const groupedData = {};
  
      data.forEach(item => {
        const groupKey = groupByKeys.map(key => item[key]).join(' | ');
  
        if (!groupedData[groupKey]) {
          groupedData[groupKey] = {
            ...groupByKeys.reduce((acc, key) => ({ ...acc, [key]: item[key] }), {}),
            TotalTickets: 0,
            BookedTickets: 0,
            TotalGross: 0,
            BookedGross: 0,
            venueSet: new Set(),
            showSet: new Set(),
            TheaterCount: 0,
            ShowCount: 0
          };
        }
  
        if (tableType === 'overall') {
          groupedData[groupKey].TotalTickets += item.MaxSeats;
          groupedData[groupKey].BookedTickets += item.BookedTickets;
        } else {
          groupedData[groupKey].MaxSeats = (groupedData[groupKey].MaxSeats || 0) + item.MaxSeats;
          groupedData[groupKey].SeatsAvailable = (groupedData[groupKey].SeatsAvailable || 0) + item.SeatsAvailable;
          groupedData[groupKey].BookedTickets = (groupedData[groupKey].BookedTickets || 0) + item.BookedTickets;
        }
  
        groupedData[groupKey].TotalGross += parseFloat(item.TotalGross);
        groupedData[groupKey].BookedGross += parseFloat(item.BookedGross);
  
        if (tableType === 'overall' || tableType === 'city' || tableType === 'area') {
          groupedData[groupKey].venueSet.add(item.VenueName);
          groupedData[groupKey].showSet.add(`${item.VenueName} | ${item.ShowTime}`);
        } else if (tableType === 'theater') {
          groupedData[groupKey].showSet.add(item.ShowTime);
        }
      });
  
      // Now calculate counts and remove temporary sets
      const result = Object.values(groupedData).map(group => {
        if (tableType === 'overall') {
          group.TheaterCount = group.venueSet.size;
          group.ShowCount = group.showSet.size;
        } else if (tableType === 'city' || tableType === 'area') {
          group.TheaterCount = group.venueSet.size;
          group.ShowCount = group.showSet.size;
        } else if (tableType === 'theater') {
          group.ShowCount = group.showSet.size;
        }
  
        delete group.venueSet;
        delete group.showSet;
  
        if (tableType === 'overall') {
          const occupancy = group.TotalTickets > 0 ? ((group.BookedTickets / group.TotalTickets) * 100).toFixed(2) : '0.00';
          return {
            ...group,
            Occupancy: parseFloat(occupancy)
          };
        } else {
          const occupancy = group.MaxSeats > 0 ? ((group.BookedTickets / group.MaxSeats) * 100).toFixed(2) : '0.00';
          return {
            ...group,
            Occupancy: parseFloat(occupancy),
            TotalGross: group.TotalGross.toFixed(2),
            BookedGross: group.BookedGross.toFixed(2)
          };
        }
      });
  
      return result;
    }
  
    // Navigation Links Event Listener
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        // Remove 'active' class from all links
        navLinks.forEach(l => l.classList.remove('active'));
        // Add 'active' class to the clicked link
        this.classList.add('active');
        // Set the current table type
        currentTable = this.getAttribute('data-table');
  
        // Render the corresponding table
        renderTable(currentTable);
        // Re-apply search filter
        applySearchFilter();
      });
    });
  
    // City Dropdown Event Listener (Handles Multiple Selections)
    cityDropdown.addEventListener('change', async function() {
      const selectedOptions = Array.from(this.selectedOptions).map(option => option.value);
      if (selectedOptions.length === 0) {
        alert('Please select at least one city.');
        return;
      }
      await fetchShowtimes(selectedOptions);
      // Reset to default table (Overall Summary)
      currentTable = 'overall';
      // Update active link
      navLinks.forEach(l => l.classList.remove('active'));
      navLinks.forEach(l => {
        if (l.getAttribute('data-table') === 'overall') {
          l.classList.add('active');
        }
      });
      // Clear search box
      searchBox.value = '';
    });
  
    // Function to sort the table by a specific column
    function sortTableByColumn(columnIndex, tableType) {
      // Prevent sorting if Index column is clicked
      if (columnIndex === 0) return;
  
      // Define headersMap to match headers
      const headersMap = {
        'overall': ["Index", "City", "Theater Count", "Show Count", "Total Tickets", "Booked Tickets", "Total Gross", "Booked Gross", "Occupancy (%)"],
        'city': ["Index", "Theater Count", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"],
        'area': ["Index", "Area", "Theater Count", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"],
        'theater': ["Index", "Area", "Venue Name", "Show Count", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"],
        'showtime': ["Index", "Area", "Venue Name", "Show Time", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Total Gross", "Booked Gross"],
        'category': ["Index", "City", "Area", "Venue Name", "Show Time", "Category", "Max Seats", "Seats Available", "Booked Tickets", "Occupancy (%)", "Price", "Total Gross", "Booked Gross"]
      };
  
      const headerText = headersMap[tableType][columnIndex];
      const key = headerText.replace(/ /g, '');
  
      if (!keyMap[headerText] && key !== 'City' && key !== 'Area') return; // If key is undefined (e.g., Index column), do nothing
  
      const sortKey = keyMap[headerText] || key;
  
      // Toggle sort direction
      if (sortTableByColumn.lastColumnIndex === columnIndex) {
        sortTableByColumn.descending = !sortTableByColumn.descending;
      } else {
        sortTableByColumn.descending = false;
      }
      sortTableByColumn.lastColumnIndex = columnIndex;
  
      // Get the data to sort
      let dataToSort;
      if (tableType === 'category') {
        dataToSort = [...globalData];
      } else if (tableType === 'overall') {
        dataToSort = groupData(globalData, ['City'], 'overall');
      } else {
        const groupByKeys = headersMap[tableType].slice(1).map(header => header.replace(/ /g, ''));
        dataToSort = groupData(globalData, groupByKeys, tableType);
      }
  
      dataToSort.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
  
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
  
        if (valA < valB) return sortTableByColumn.descending ? 1 : -1;
        if (valA > valB) return sortTableByColumn.descending ? -1 : 1;
        return 0;
      });
  
      // Update globalData if 'category'
      if (tableType === 'category') {
        globalData = dataToSort;
      }
  
      // Re-render the table with sorted data
      renderTable(tableType);
      // Re-apply search filter
      applySearchFilter();
    }
  
    // Initialize sort direction
    sortTableByColumn.descending = false;
    sortTableByColumn.lastColumnIndex = -1;
  
    // Function to apply search filter
    function applySearchFilter() {
      const filter = searchBox.value.toLowerCase();
      const tbody = document.getElementById('table-body');
      if (!tbody) return;
      const rows = Array.from(tbody.getElementsByTagName('tr'));
  
      // Remove the total row from the array if it exists
      let totalRow = null;
      if (currentTable !== 'overall') {
        totalRow = rows.pop();
      }
  
      rows.forEach(row => {
        const cells = row.getElementsByTagName('td');
        let rowContainsFilter = false;
  
        for (let j = 1; j < cells.length; j++) { // Start from 1 to skip Index column
          const cellText = cells[j].innerText.toLowerCase();
          if (cellText.indexOf(filter) > -1) {
            rowContainsFilter = true;
            break;
          }
        }
  
        row.style.display = rowContainsFilter ? '' : 'none';
      });
  
      // Recalculate totals based on filtered data if not 'overall' table
      if (currentTable !== 'overall') {
        const visibleRows = rows.filter(row => row.style.display !== 'none');
        const filteredData = visibleRows.map(row => {
          const cells = row.getElementsByTagName('td');
          const rowData = {};
          const headers = tbody.parentNode.tHead.rows[0].cells;
  
          for (let i = 1; i < cells.length; i++) { // Start from 1 to skip Index column
            const headerText = headers[i].innerText.replace(/ /g, '');
            let value = cells[i].innerText;
            if (['MaxSeats', 'SeatsAvailable', 'BookedTickets', 'Occupancy(%)', 'TotalGross', 'BookedGross', 'TheaterCount', 'ShowCount', 'Price', 'CityCount', 'TotalTickets'].includes(headerText)) {
              value = parseFloat(value.replace(/,/g, '').replace('%', ''));
            }
            rowData[keyMap[headerText]] = value; // Use keyMap to assign correct keys
          }
          return rowData;
        });
  
        calculateTotals(filteredData, currentTable);
  
        // Update the total row
        if (totalRow) {
          const totalCells = totalRow.getElementsByTagName('td');
          const headers = tbody.parentNode.tHead.rows[0].cells;
  
          for (let i = 1; i < totalCells.length; i++) { // Start from 1 to skip Index column
            const headerText = headers[i].innerText.replace(/ /g, '');
            const key = keyMap[headerText];
            if (['CityCount', 'TheaterCount', 'ShowCount', 'TotalTickets'].includes(key)) {
              totalCells[i].innerText = totalRowData[key];
            } else if (key === 'Occupancy') {
              totalCells[i].innerText = parseFloat(totalRowData[key]).toFixed(2) + '%';
            } else if (['TotalGross', 'BookedGross', 'Price'].includes(key)) {
              totalCells[i].innerText = parseFloat(totalRowData[key]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else {
              totalCells[i].innerText = totalRowData[key];
            }
          }
        }
      }
  
      // For 'overall' table, no need to recalculate totals
    }
  
    // Key Map for Header Text to Data Keys
    const keyMap = {
      "Index": "Index",
      "City": "City",
      "Area": "Area",
      "Venue Name": "VenueName",
      "Show Time": "ShowTime",
      "Category": "Category",
      "Max Seats": "MaxSeats",
      "Seats Available": "SeatsAvailable",
      "Booked Tickets": "BookedTickets",
      "Occupancy (%)": "Occupancy",
      "Price": "Price",
      "Total Gross": "TotalGross",
      "Booked Gross": "BookedGross",
      "Theater Count": "TheaterCount",
      "Show Count": "ShowCount",
      "City Count": "CityCount",
      "Total Tickets": "TotalTickets"
    };
  
    // Initialize the application
    populateCityDropdown();
    fetchInitialData();
  });  
// Mock stats (will be replaced by API)
document.getElementById("totalRevenue").innerText = "$12,450";
document.getElementById("totalSales").innerText = "134";

// Chart
const ctx = document.getElementById("revenueChart");

new Chart(ctx, {
    type: "line",
    data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        datasets: [{
            label: "Revenue",
            data: [2000, 2500, 1800, 3000, 3150],
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true
    }
});

// Table mock
const table = document.getElementById("salesTable");
table.innerHTML = `
<tr>
    <td>2026-01-18</td>
    <td>Laptop</td>
    <td>Electronics</td>
    <td>2</td>
    <td>$2400</td>
</tr>
<tr>
    <td>2026-01-18</td>
    <td>Phone</td>
    <td>Electronics</td>
    <td>3</td>
    <td>$1800</td>
</tr>
`;

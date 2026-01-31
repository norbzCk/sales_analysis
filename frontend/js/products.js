const API = "http://127.0.0.1:8000/products";

// Fetch and render products
async function fetchProducts() {
  const tbody = document.getElementById("product-list");
  tbody.innerHTML = "<tr><td colspan='5'>Loading…</td></tr>";

  try {
    const res = await fetch(API);
    const products = await res.json();

    if (products.length === 0) {
      tbody.innerHTML = "<tr><td colspan='5'>No products found</td></tr>";
      return;
    }

    tbody.innerHTML = "";
    products.forEach(prod => {
      tbody.innerHTML += `
        <tr>
          <td>${prod.name}</td>
          <td>${prod.category}</td>
          <td>${prod.price}</td>
          <td>${prod.stock}</td>
          <td>${prod.description}</td>
          <td>
            <button onclick="deleteProduct(${prod.id})">Delete</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = "<tr><td colspan='5'>Failed to load products</td></tr>";
    console.error(err);
  }
}

// Add product
async function addProduct() {
  const name = document.getElementById("name").value.trim();
  const category = document.getElementById("category").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const stock = parseFloat(document.getElementById("stock").value);
  const description = document.getElementById("description").value.trim();

  if (!name || !category || isNaN(price) || isNaN(stock)) {
    alert("Fill all fields correctly");
    return;
  }

  try {
    const res = await fetch (API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, price, stock, description })
    });
    if (!res.ok) throw new Error("Failed to add product");
    fetchProducts(); // refresh table
    document.getElementById("name").value = "";
    document.getElementById("category").value = "";
    document.getElementById("price").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("description").value = "";

  } catch (err) {
    alert("Failed to add product");
    console.error(err);
  }
}

// Delete product
async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await fetch(`${API}/${id}`, { method: "DELETE" });
    fetchProducts();
  } catch (err) {
    alert("Failed to delete product");
    console.error(err);
  }
}

// Initial load
fetchProducts();

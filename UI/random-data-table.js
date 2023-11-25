class RandomDataTable extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.data = [];
    }

    connectedCallback() {
        this.render();
    }

    setData(newData) {
        this.data = newData;
        this.render();
    }

    render() {
        let tableHTML = `
            <style>
                /* Styling for the table */
                table {
                    border-collapse: collapse;
                    width: 80%;
                    margin: 20px auto;
                    box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);
                    border-radius: 8px;
                    overflow: hidden;
                }

                th, td {
                    padding: 12px 20px;
                    text-align: left;
                    font-family: 'Arial', sans-serif;
                }

                tr {
                    transition: background-color 0.3s ease;
                }

                th {
                    background-color: #4CAF50;
                    color: white;
                    font-size: 18px;
                }

                td {
                    border-top: 1px solid #ddd;
                    font-size: 16px;
                }

                tr:nth-child(even) {background-color: #f2f2f2;}

                tr:hover {background-color: #ddd;}
            </style>
            <table><tr><th>Estado Ruta</th><th>Nº Cliente</th><th>Hora entrada</th><th>Hora salida</th><th>Duración</th><th>Nº Ticket</th><th>Cantidad Artículos</th></tr>`;

        this.data.forEach(row => {
            tableHTML += `<tr><td>${row.state}</td><td>${row.customer}</td><td>${row.start}</td><td>${row.finish}</td><td>${row.duration}</td><td>${row.ticketsNre}</td><td>${row.productNre}</td></tr>`;
        });

        tableHTML += `</table>`;
        this.shadowRoot.innerHTML = tableHTML;
    }
}

customElements.define('random-data-table', RandomDataTable);

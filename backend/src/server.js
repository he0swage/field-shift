const express = require("express");
const router = require("../../../../ThinkBoard/back-end/src/routes/routesnote");
const app = express();
const PORT =  5001;

app.use(express.json());
app.use("/api",router);
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
const express = require('express');
const app = express();
const port = 3000;
const {getDetails} = require('./events');

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index', {title: 'Home'});
})

app.post('/fetch', (req, res) => {
    const datas = getDetails();
    return res.json(datas);
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
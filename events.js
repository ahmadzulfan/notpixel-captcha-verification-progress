const fs = require('fs');
const path = require('path');

// Path untuk file JSON
const dirPath = './data';
const initialStateFilePath = './data/captcha.json';
const eventsFilePath = './data/events.json';
const addressFilePath = './data/address.json';
const addressDoneFilePath = './data/address_done.json';

let addressHasCaptchaList = [], addressHasCodeList = [], eventsList = [];
let tCaptchaFee = 0, tCaptchaFeeRefund = 0, duplicateTx = 0;

//Dev address for request captcha
const hexAddress = '0:d3c3061cc5900ff08cec1d37baff091fce4e5c26b211d47e8ee649728093bb11';
// Start date 18 Desember 2024
const start_date = 1734454800;
// End date 30 Desember 2024
const end_date = 1735491600;

const saveSession = (tFee, tFeeRefund, hasReq, hasCode, tTx, duplicatetx) => {
    const datas = {
        'address' : 'UQDTwwYcxZAP8IzsHTe6_wkfzk5cJrIR1H6O5klygJO7EYzX',
        'total_captcha_fee' : tFee,
        'total_captcha_fee_refund' : tFeeRefund,
        'user_has_request' : hasReq,
        'user_has_code' : hasCode,
        'total_tx' : tTx,
        'duplicate_tx' : duplicatetx
    }

    fs.writeFileSync(initialStateFilePath, JSON.stringify(datas, null, 2), 'utf-8');
}

if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);

if (!fs.existsSync(initialStateFilePath)) saveSession(0, 0, 0, 0, 0, 0);

if (!fs.existsSync(eventsFilePath)) fs.writeFileSync(eventsFilePath, JSON.stringify([]), 'utf-8');

const fileBuffer = fs.readFileSync(initialStateFilePath, 'utf-8');
const session = JSON.parse(fileBuffer);
tCaptchaFee = session.total_captcha_fee;
tCaptchaFeeRefund = session.total_captcha_fee_refund;
duplicateTx = session.duplicate_tx;

//all user address request captcha
const listAddressCaptcha = () => {
    if (!fs.existsSync(addressFilePath)) fs.writeFileSync(addressFilePath, JSON.stringify([]), 'utf-8');
    const fileBuffer = fs.readFileSync(addressFilePath, 'utf-8');
    return JSON.parse(fileBuffer);
}

//total user received captcha code
const listAddressHasCode = () => {
    if (!fs.existsSync(addressDoneFilePath)) fs.writeFileSync(addressDoneFilePath, JSON.stringify([]), 'utf-8');
    const fileBuffer = fs.readFileSync(addressDoneFilePath, 'utf-8');
    return JSON.parse(fileBuffer);
}

const cekUrl = (hexAddress, start_date, end_date, next_from) => {
    let url = `https://tonapi.io/v2/accounts/${hexAddress}/events?limit=100&start_date=${start_date}&end_date=${end_date}`;
    if (next_from) url = `https://tonapi.io/v2/accounts/${hexAddress}/events?limit=100&before_lt=${next_from}&start_date=${start_date}&end_date=${end_date}`;
    return url;
}

const getNextFormTx = () => {
    const fileBuffer = fs.readFileSync(eventsFilePath, 'utf-8');
    const datas = JSON.parse(fileBuffer);
    if (datas.length === 0) return null;
    return datas[datas.length - 1];
}

const saveEvents = async (events) => {

    try {
        const fileBuffer = fs.readFileSync(eventsFilePath, 'utf-8');
        const datas = JSON.parse(fileBuffer);
        
        datas.push(events[99]);
        
        fs.writeFileSync(eventsFilePath, JSON.stringify(datas, null, 2), 'utf-8');
    } catch (error) {
        console.error(error);
    }

}

const saveAddressHasCaptcha = (addresses) => {

    try {
        const fileBuffer = fs.readFileSync(addressFilePath, 'utf-8');
        const datas = JSON.parse(fileBuffer);
        addresses.forEach(e => {
            tCaptchaFee += 0.1;
        });
        datas.push(...addresses);
    
        fs.writeFileSync(addressFilePath, JSON.stringify(datas, null, 2), 'utf-8');
    } catch (error) {
        console.error(error);
    }
};

const saveAddressHasCode = (addresses) => {

    try {
        const fileBuffer = fs.readFileSync(addressDoneFilePath, 'utf-8');
        const datas = JSON.parse(fileBuffer);
        addresses.forEach(e => {
            tCaptchaFeeRefund += 0.05;
        });
        datas.push(...addresses)
        
        fs.writeFileSync(addressDoneFilePath, JSON.stringify(datas, null, 2), 'utf-8');
    } catch (error) {
        console.error(error);
    }

};

setInterval(async () => {
    const next_from = getNextFormTx();
    const url = cekUrl(hexAddress, start_date, end_date, next_from);
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.events && data.events.length > 0) {
            data.events.forEach(transaction => {
                if (transaction.actions && transaction.actions.length > 0) {
                    eventsList.push(data.next_from);
                    transaction.actions.forEach(act => {
                        if (act.type == "TonTransfer") {
                            const senderAdderss = act.TonTransfer.sender.address;
                            const recipientAddress = act.TonTransfer.recipient.address;
                            amount = parseFloat(act.simple_preview.value.match(/\d+(\.\d+)?/)[0]);
                            if (senderAdderss !== hexAddress) {
                                addressHasCaptchaList.push(senderAdderss);
                            } else if (senderAdderss == hexAddress && recipientAddress !== hexAddress && amount == 0.05) {
                                addressHasCodeList.push(recipientAddress);
                            }
                        }
                    });
                }                
            });
            
            const dataAddressHasCaptcha = [...new Set(listAddressCaptcha())];

            const dataAddressHasDone = [...new Set(listAddressHasCode())];

            const uniqueUserRequest = dataAddressHasCaptcha.length;
            const uniqueUserDone = dataAddressHasDone.length;
            
            duplicateTx = listAddressCaptcha().length - uniqueUserRequest;

            saveEvents(eventsList);
            eventsList = [];
            
            saveAddressHasCaptcha(addressHasCaptchaList);
            addressHasCaptchaList = [];

            saveAddressHasCode(addressHasCodeList);
            addressHasCodeList = [];
            
            saveSession(Number(tCaptchaFee.toFixed(1)), Number(tCaptchaFeeRefund.toFixed(1)), uniqueUserRequest, uniqueUserDone, 0, duplicateTx);
        } else {
            console.log("Tidak ada transaksi ditemukan.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}, 1050);

const getDetails = () => {
    const fileBuffer = fs.readFileSync(initialStateFilePath, 'utf-8');
    const session = JSON.parse(fileBuffer);
    return session;
}

module.exports = {getDetails};
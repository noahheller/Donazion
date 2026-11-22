import axios from "axios"

// all WEB traffic using this API instance. You should replace this endpoint with whatever
// you developed for the tutorial and adjust resources as necessary.
const instance = axios.create({
  baseURL: 'https://u5k0cp2nn4.execute-api.us-east-2.amazonaws.com/prod/'
});

export default instance
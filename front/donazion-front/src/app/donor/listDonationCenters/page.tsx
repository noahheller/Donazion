'use client'                     // NEED THIS to be able to embed HTML in TSX file
import React from 'react'

import {isAxiosError} from "axios"
import instance from "../../aws"



interface ApiError {
  statusCode?: number
  error?: string
  message?: string
}

async function loadDonationCenters() {
  try {
    const response = await instance.get("/donation-centers");
    return response.data;

  } catch (error) {
    console.error("Error loading donation centers:", error);
    throw new Error("Failed to load donation centers");
  }
}


export default function ListDonationCenters() {
  return (
    <div>
      <h1>Donation Centers</h1>
      <p>Coming soon.</p>
    </div>
  )
}

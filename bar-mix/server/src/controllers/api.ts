// This file exports functions that handle API requests and responses.

import { Request, Response } from 'express';

// Example function to handle a GET request
export const getExampleData = (req: Request, res: Response) => {
    res.json({ message: 'This is example data' });
};

// Example function to handle a POST request
export const postExampleData = (req: Request, res: Response) => {
    const data = req.body;
    res.status(201).json({ message: 'Data received', data });
};
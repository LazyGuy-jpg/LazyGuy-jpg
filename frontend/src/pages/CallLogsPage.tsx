import React, { useState } from 'react';
import { Container, Typography, Table, TableHead, TableBody, TableRow, TableCell, TablePagination, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

interface CallLog {
  callId: string;
  toNumber: string;
  fromNumber: string;
  status: string;
  actualTime: number;
  billableTime: number;
  balanceCut: string;
}

export default function CallLogsPage() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['callLogs', page, rowsPerPage],
    queryFn: async () => {
      const res = await api.get(`/api/call-logs?page=${page + 1}&limit=${rowsPerPage}`);
      return res.data;
    },
  });

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRows = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Call Logs</Typography>
      {isLoading ? <CircularProgress /> : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Call ID</TableCell>
                <TableCell>To</TableCell>
                <TableCell>From</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.data.logs?.map((log: CallLog) => (
                <TableRow key={log.callId}>
                  <TableCell>{log.callId}</TableCell>
                  <TableCell>{log.toNumber}</TableCell>
                  <TableCell>{log.fromNumber}</TableCell>
                  <TableCell>{log.status}</TableCell>
                  <TableCell>{log.actualTime}s</TableCell>
                  <TableCell>${log.balanceCut}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={data?.data.total || 0}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRows}
          />
        </>
      )}
    </Container>
  );
}
import { NextResponse } from 'next/server';

const MOCK_TASKS = [
  { id: 'task_0x4f3a1b', agent: 'WebSearch Pro', amount: '0.085', status: 'complete', timestamp: '2 min ago' },
  { id: 'task_0x7c2d9e', agent: 'CodeExec Engine', amount: '0.150', status: 'complete', timestamp: '8 min ago' },
  { id: 'task_0x1a8f4c', agent: 'WebSearch Pro', amount: '0.085', status: 'failed', timestamp: '15 min ago' },
  { id: 'task_0x9b5e2d', agent: 'DataWorker', amount: '0.200', status: 'escrowed', timestamp: '23 min ago' },
  { id: 'task_0x3c7a6f', agent: 'CodeExec Engine', amount: '0.150', status: 'complete', timestamp: '41 min ago' },
  { id: 'task_0x6d1b8e', agent: 'WebSearch Pro', amount: '0.085', status: 'complete', timestamp: '1 hr ago' },
  { id: 'task_0x2e9c4a', agent: 'DataWorker', amount: '0.200', status: 'disputed', timestamp: '1 hr ago' },
  { id: 'task_0x8f3d7b', agent: 'CodeExec Engine', amount: '0.150', status: 'complete', timestamp: '2 hr ago' },
  { id: 'task_0x5a1e9c', agent: 'WebSearch Pro', amount: '0.085', status: 'complete', timestamp: '3 hr ago' },
  { id: 'task_0x4b7f2d', agent: 'DataWorker', amount: '0.200', status: 'queued', timestamp: '4 hr ago' },
];

export async function GET() {
  return NextResponse.json({ success: true, data: MOCK_TASKS, error: null });
}

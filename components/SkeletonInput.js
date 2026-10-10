'use client';
import { Skeleton } from 'antd';

// Skeleton.Input is a static member, so it is wrapped here for use from server components.
export default function SkeletonInput(props) {
  return <Skeleton.Input {...props} />;
}

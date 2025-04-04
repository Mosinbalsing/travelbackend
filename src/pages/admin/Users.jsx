// import React, { useState, useEffect } from 'react';
// import { Button } from "@/components/ui/button";
// import {
//     Table,
//     TableBody,
//     TableCell,
//     TableHead,
//     TableHeader,
//     TableRow,
// } from "@/components/ui/table";
// import { getUsers } from '@/config/api';
// import { useToast } from "@/components/ui/use-toast";

// const Users = () => {
//     const [users, setUsers] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const { toast } = useToast();

//     useEffect(() => {
//         fetchUsers();
//     }, []);

//     const fetchUsers = async () => {
//         try {
//             setLoading(true);
//             const response = await getUsers();
//             if (response.success) {
//                 // Ensure each user has a valid ID
//                 const validUsers = response.data.filter(user => user.user_id);
//                 setUsers(validUsers);
//             } else {
//                 toast({
//                     variant: "destructive",
//                     title: "Error",
//                     description: response.message || "Failed to fetch users"
//                 });
//             }
//         } catch (error) {
//             toast({
//                 variant: "destructive",
//                 title: "Error",
//                 description: error.message || "Failed to fetch users"
//             });
//         } finally {
//             setLoading(false);
//         }
//     };

//     if (loading) {
//         return <div>Loading...</div>;
//     }

//     return (
//         <div className="container mx-auto py-10">
//             <h1 className="text-2xl font-bold mb-6">Users</h1>
//             <div className="rounded-md border">
//                 <Table>
//                     <TableHeader>
//                         <TableRow>
//                             <TableHead>ID</TableHead>
//                             <TableHead>Name</TableHead>
//                             <TableHead>Email</TableHead>
//                             <TableHead>Mobile</TableHead>
//                             <TableHead>Actions</TableHead>
//                         </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                         {users.map((user) => (
//                             <TableRow key={user.user_id}>
//                                 <TableCell>{user.user_id}</TableCell>
//                                 <TableCell>{user.name}</TableCell>
//                                 <TableCell>{user.email}</TableCell>
//                                 <TableCell>{user.mobile}</TableCell>
//                                 <TableCell>
//                                     <Button
//                                         variant="outline"
//                                         size="sm"
//                                         onClick={() => handleEdit(user)}
//                                     >
//                                         Edit
//                                     </Button>
//                                 </TableCell>
//                             </TableRow>
//                         ))}
//                     </TableBody>
//                 </Table>
//             </div>
//         </div>
//     );
// };

// export default Users; 
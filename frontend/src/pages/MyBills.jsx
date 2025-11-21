import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { hmsApi } from "../services/api";
import { toast } from "react-toastify";

const MyBills = () => {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [processingPayment, setProcessingPayment] = useState(false);

  const handlePaymentSuccess = async (chargeId) => {
    try {
      await hmsApi.handlePaymentSuccess(chargeId);
      toast.success('Payment successful! Charge status updated.');
      // Reload charges to reflect the updated status
      loadCharges();
    } catch (err) {
      console.error('Error handling payment success:', err);
      toast.error('Payment was successful, but there was an error updating the charge status.');
    }
  };

  useEffect(() => {
    loadCharges();
    
    // Check if redirected from Stripe payment
    const paymentStatus = searchParams.get('payment');
    const chargeId = searchParams.get('chargeId');
    
    if (paymentStatus === 'success' && chargeId) {
      handlePaymentSuccess(chargeId);
      // Clean up URL parameters
      setSearchParams({});
    } else if (paymentStatus === 'cancelled') {
      toast.info('Payment was cancelled');
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCharges = async () => {
    try {
      setLoading(true);
      const response = await hmsApi.getMyCharges();
      setCharges(response.charges || []);
    } catch (err) {
      setError("Failed to load your bills: " + err.message);
      toast.error("Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  const filteredCharges = charges.filter((charge) => {
    return filterStatus === "all" || charge.status === filterStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "paid":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const calculateTotal = () => {
    return filteredCharges.reduce((sum, charge) => {
      if (charge.status === "pending") {
        return sum + charge.amount;
      }
      return sum;
    }, 0);
  };

  const calculateTotalPaid = () => {
    return filteredCharges.reduce((sum, charge) => {
      if (charge.status === "paid") {
        return sum + charge.amount;
      }
      return sum;
    }, 0);
  };

  const handlePayNow = async (charge) => {
    try {
      setProcessingPayment(true);
      
      // Create Stripe checkout session
      const response = await hmsApi.createCheckoutSession({ chargeId: charge.id });
      
      if (response.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.url;
      } else {
        toast.error('Failed to create payment session');
        setProcessingPayment(false);
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      toast.error('Failed to initiate payment: ' + err.message);
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">My Bills</h1>
        <div className="text-sm text-gray-600">
          Total Charges: {charges.length}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Total Pending</div>
          <div className="text-2xl font-bold text-yellow-600">
            ${calculateTotal().toFixed(2)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Total Paid</div>
          <div className="text-2xl font-bold text-green-600">
            ${calculateTotalPaid().toFixed(2)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Total Amount</div>
          <div className="text-2xl font-bold text-gray-800">
            ${(calculateTotal() + calculateTotalPaid()).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Charges Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Charge Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCharges.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No bills found
                  </td>
                </tr>
              ) : (
                filteredCharges.map((charge) => (
                  <tr key={charge.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {charge.chargeName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        {charge.description || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        ${charge.amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          charge.status
                        )}`}
                      >
                        {charge.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(charge.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {charge.status === "pending" && (
                        <button
                          onClick={() => handlePayNow(charge)}
                          disabled={processingPayment}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
                        >
                          {processingPayment ? 'Processing...' : 'Pay Now'}
                        </button>
                      )}
                      {charge.status === "paid" && (
                        <span className="text-green-600 text-sm">Paid</span>
                      )}
                      {charge.status === "cancelled" && (
                        <span className="text-gray-400 text-sm">Cancelled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyBills;


package com.services

import SocketService
import constants.FriendSocketsEmitEvents
import constants.FriendSocketsSubscribeEvents
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import interfaces.AccountFriend
import interfaces.PartialAccount
import interfaces.dto.FriendRequestData
import interfaces.toJson
import interfaces.toObject
import org.json.JSONArray
import org.json.JSONObject

object FriendSocketService : Service() {

    // Friend requests that the user has sent
    private val _friendsThatUserRequested = MutableLiveData<List<String>>(emptyList())
    val friendsThatUserRequested: LiveData<List<String>> get() = _friendsThatUserRequested

    // Incoming friend requests for the user
    private val _friendRequestsReceived = MutableLiveData<List<FriendRequestData>>(emptyList())
    val friendRequestsReceived: LiveData<List<FriendRequestData>> get() = _friendRequestsReceived

    private val _friends = MutableLiveData<List<String>>(emptyList())
    val friends: LiveData<List<String>> get() = _friends

    private val _blocked = MutableLiveData<List<String?>>()
    val blocked: LiveData<List<String?>> get() = _blocked

    private val _usersBlockingMe = MutableLiveData<List<String?>>()
    val usersBlockingMe: LiveData<List<String?>> get() = _usersBlockingMe

    private val _newAccounts = MutableLiveData<List<PartialAccount>>()
    val newAccounts: LiveData<List<PartialAccount>> get() = _newAccounts

    private val socketService = SocketService
    private var accounts = emptyList<AccountFriend>()


    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    init {
        // Disconnect socket when the app shuts down
        Runtime.getRuntime().addShutdownHook(Thread {
            try {
                SocketService.disconnect()
            } catch (e: Exception) {
                Log.e("FriendSocketService", e.toString())
            }
        })
    }

    fun connect() {
        SocketService.connect()
        Log.d("FriendSocketService", "connect() called.")
        setUpSocketListeners()
    }

    fun resetService() {
        _friendsThatUserRequested.postValue(emptyList())
        _friends.postValue(emptyList())
        _friendRequestsReceived.postValue(emptyList())
        _blocked.postValue(emptyList())
        _usersBlockingMe.postValue(emptyList())
//        SocketService.disconnect()
    }

    private fun setUpSocketListeners() {
        this.accounts = this.mapAccounts(this.accounts)

        SocketService.on<JSONArray>("accountCreated") { data ->
            val dataString = data.toString()
            val typeAccount = object : TypeToken<List<PartialAccount>>() {}.type
            val newAccount: List<PartialAccount> = Gson().fromJson(dataString, typeAccount)
            _newAccounts.postValue(newAccount)
            this.accounts = this.mapAccounts(this.accounts)
        }

        SocketService.on<JSONArray>("friendRequestsSentUpdated") { data ->
            try {
                val dataString = data.toString()
                val typeFriendRequest = object : TypeToken<List<String>>() {}.type
                val friendsThatUserRequested: List<String> = Gson().fromJson(dataString, typeFriendRequest)
                _friendsThatUserRequested.postValue(friendsThatUserRequested)
                this.accounts = this.mapAccounts(this.accounts)
                Log.d("FriendSocketService", "friendsThatUserRequested: $friendsThatUserRequested")
            } catch (e: Exception) {
                Log.e("FriendSocketService", "Error processing friend request sent: ${e.message}")
            }
        }

        SocketService.on<JSONArray>("friendRequestsReceivedUpdated") { data ->
            try {
                val dataString = data.toString()
                val typeFriendRequest = object : TypeToken<List<FriendRequestData>>() {}.type
                val friendRequests: List<FriendRequestData> = Gson().fromJson(dataString, typeFriendRequest)
                _friendRequestsReceived.postValue(friendRequests)
                this.accounts = this.mapAccounts(this.accounts)
                Log.d("FriendSocketService", "New friend request: $friendRequests")
            } catch (e: Exception) {
                Log.e("FriendSocketService", "Error processing FriendRequestData: ${e.message}")
            }
        }

        SocketService.on<JSONArray>("friendsUpdated") { data ->
            try {
                val dataString = data.toString()
                val typeFriends = object : TypeToken<List<String>>() {}.type
                val friendIds: List<String> = Gson().fromJson(dataString, typeFriends)
                _friends.postValue(friendIds)
                this.accounts = this.mapAccounts(this.accounts)

                Log.d("FriendSocketService", "New friend list: $friendIds")
            } catch (e: Exception) {
                Log.e("FriendSocketService", "Error processing friend list update: ${e.message}")
            }
        }

        SocketService.on<JSONArray>("blockedUsersUpdated") { data ->
            try {
                val dataString = data.toString()
                val typeBlocked = object : TypeToken<List<String>>() {}.type
                val blockedUsers: List<String> = Gson().fromJson(dataString, typeBlocked)
                _blocked.postValue(blockedUsers)
                this.accounts = this.mapAccounts(this.accounts)

                Log.d("FriendSocketService", "Blocked list: $blockedUsers")
            } catch (e: Exception) {
                Log.e("FriendSocketService", "Error processing blocked list : ${e.message}")
            }
        }
        SocketService.on<JSONArray>("blockedByUsersUpdated") { data ->
            try {
                val dataString = data.toString()
                val typeBlockedBy = object : TypeToken<List<String>>() {}.type
                val blockedBy: List<String> = Gson().fromJson(dataString, typeBlockedBy)
                _usersBlockingMe.postValue(blockedBy)
                this.accounts = this.mapAccounts(this.accounts)

                Log.d("FriendSocketService", "Blocked by list: $blockedBy")
            } catch (e: Exception) {
                Log.e("FriendSocketService", "Error processing blocked by list : ${e.message}")
            }
        }
    }

    private fun mapAccounts(accounts: List<AccountFriend>): List<AccountFriend> {
        val friendsList = _friends.value.orEmpty()
        val friendRequests = _friendRequestsReceived.value.orEmpty()
        val friendsThatUserRequested = _friendsThatUserRequested.value.orEmpty()

        return accounts.map { account ->
            val userId = account.userId
            val pseudonym = account.pseudonym
            val avatarUrl = account.avatarUrl
            val isFriend = friendsList.contains(account.userId)
            val isRequestReceived = friendRequests.any { it.senderBasicInfo?.userId == account.userId }
            val isRequestSent = friendsThatUserRequested.contains(account.userId)
            val isBlocked = _blocked.value.orEmpty().contains(account.userId)
            val isBlockingMe = _usersBlockingMe.value.orEmpty().contains(account.userId)

            account.copy(
                userId = userId,
                pseudonym = pseudonym,
                avatarUrl = avatarUrl,
                isFriend = isFriend,
                isRequestReceived = isRequestReceived,
                isRequestSent = isRequestSent,
                isBlocked = isBlocked,
                isBlockingMe = isBlockingMe
            )
        }
    }
}

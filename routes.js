import "./css/Register.css";
import React, { useState } from 'react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import axios from "axios";

const apiUrl = process.env.REACT_APP_API_URL;

function Register() {
    const navigate = useNavigate();
    const [account, setAccount] = useState("");
    const [password, setPassword] = useState("");
    const [nickName, setNickName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isVisible, setIsVisible] = useState([false, false]);

    // 切換密碼可見性
    const toggleVisibility = (index) => {
        setIsVisible(prev => prev.map((item, i) => (i === index ? !item : item)));
    };

    // 處理註冊成功的跳轉
    const handleNavigate = (id) => {
        navigate('/photo', { state: { id } });
    };

    const handleSuccess = () => {
        navigate('/world');
    };

    // 處理 Google 註冊
    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            const response = await axios.post(`${apiUrl}/api/register`, {
                account: user.email,
                nickName: user.displayName,
                password: "google_generated_password",
                googleLogin: true,
                photoUrl: user.photoURL
            }, {
                headers: { "Content-Type": "application/json" }
            });

            console.log("伺服器回應:", response.data);

            if (response.status === 200) {
                alert("註冊成功!");
                handleSuccess();
            } else {
                console.error("註冊失敗：", response.data.error);
                alert("註冊失敗：" + response.data.error);
            }
        } catch (error) {
            console.error("Google 註冊錯誤：", error.response?.data || error.message);
            const errorMessage = error.response?.data?.error || error.response?.data || error.message || "未知錯誤";
            alert("Google 註冊錯誤：" + errorMessage);
        }
    };

    // 處理一般註冊
    const handleRegister = async () => {
        if (!account || !password || !nickName || !confirmPassword) {
            alert("請填寫所有必填欄位！");
            return;
        }

        if (password !== confirmPassword) {
            alert("密碼與確認密碼不一致！");
            return;
        }

        try {
            console.log("發送註冊請求", { account, nickName, password, googleLogin: false });

            const response = await axios.post(`${apiUrl}/api/register`, {
                account,
                nickName,
                password,
                googleLogin: false
            }, {
                headers: { "Content-Type": "application/json" }
            });

            if (response.status === 200) {
                alert("註冊成功!");
                handleNavigate(response.data.user.id);
            } else {
                console.error("註冊失敗：", response.data.error);
                alert("註冊失敗：" + response.data.error);
            }
        } catch (error) {
            console.error("網路錯誤：", error.response?.data || error.message);
            alert("網路錯誤，請稍後再試！");
        }
    };

    return (
        <div className="login-container">
            <Link to="/">
                <div className="login-logo">
                    <img src="/logo_small.svg" alt="Logo" />
                </div>
            </Link>

            <div className="login_text">
                <img src="/register_title.svg" alt="Logo" />
            </div>

            <div className="login-box-register">
                <div className="input-container-register">
                    <input
                        type="text"
                        placeholder="暱稱"
                        value={nickName}
                        onChange={(e) => setNickName(e.target.value)}
                    />
                    <img src="/user_icon.svg" alt="Name Icon" />
                </div>

                <div className="input-container-register">
                    <input
                        type="email"
                        placeholder="電子郵件"
                        value={account}
                        onChange={(e) => setAccount(e.target.value)}
                    />
                    <img src="/mail_icon.svg" alt="Email Icon" />
                </div>

                <div className="input-container-register">
                    <input
                        type={isVisible[0] ? 'text' : 'password'}
                        placeholder="密碼"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <img src="/key_icon.svg" alt="Password Icon" />
                    <img
                        src={isVisible[0] ? "/remove_red_eye_not.svg" : "/remove_red_eye.svg"}
                        alt="檢視密碼"
                        id="RegisterPasswordEye"
                        onClick={() => toggleVisibility(0)}
                    />
                </div>

                <div className="input-container-register">
                    <input
                        type={isVisible[1] ? 'text' : 'password'}
                        placeholder="確認密碼"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <img src="/key_icon.svg" alt="Password Icon" />
                    <img
                        src={isVisible[1] ? "/remove_red_eye_not.svg" : "/remove_red_eye.svg"}
                        alt="檢視密碼"
                        id="RegisterPasswordEye2"
                        onClick={() => toggleVisibility(1)}
                    />
                </div>

                <div className="button-register">
                    <img src="/next_step.svg" alt="" onClick={handleRegister} />
                </div>

                <div className="other-login-register">
                    <img src="/other_way_login.svg" alt="" />
                    <div className="other-login-icons-register">
                        <img src="/google_btn.svg" alt="Google 註冊" onClick={handleGoogleLogin} />
                    </div>
                </div>

                <div className="register-login">
                    <Link to="/login"><img src="/have.svg" alt="" id="register" /></Link>
                </div>
            </div>
        </div>
    );
}

export default Register;

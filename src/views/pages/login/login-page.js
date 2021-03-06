import React, {Component} from 'react';
import LoginForm from "../../components/forms/login-form"
import { Link } from 'react-router-dom'
import {UserContext} from '../../../contexts/userContext';
import {isEmpty} from "lodash";



export default class LoginPage extends Component {
    componentDidMount(){
        if(!isEmpty(this.context.user)) {
            window.location.href = "/"
        }
    }
    render() {

        return (
            <div class="login-page">
                <h2>Login</h2>
                <LoginForm />
                <p>Don't have an account? <Link to="/signup">Sign up here</Link></p>
            </div>
        );
    }
}
LoginPage.contextType = UserContext